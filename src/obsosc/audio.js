const { getSourceList } = require('./source')

const DEBUG = process.argv.includes('--enable-log')

let audioSourceList = new Set()

module.exports = { processSourceAudio, getAudioSourceList, sendSceneAudioFeedback, sendAudioVolumeFeedback, sendAudioMuteFeedback }

async function processSourceAudio(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getAudioSourceList(networks)
        } else {
            getSourceVolume(networks, args[0])
        }
        return
    }

    if (path[1] === 'volume') {
        if (args === undefined) {
            getSourceVolume(networks, path[0])
        } else {
            setSourceVolume(networks, path[0], args[0])
        }
    } else if (path[1] === 'mute') {
        if (args === undefined) {
            getSourceMuteState(networks)
        } else {
            setSourceMuteState(networks, path[0], args[0])
        }
    }
}

async function getAudioSourceList(networks, sendOSC = true) {
    updateAudioSourceList(networks)

    try {
        const sourceList = await getSourceList(networks, false)
        if (!sourceList) {
            if (DEBUG) console.error('getAudioSourceList -- No source list')
            return []
        }
        const audioSource = []
        sourceList.forEach(source => {
            if (audioSourceList.has(source.typeId)) {
                audioSource.push(source.name)
            }
        })

        audioSource.sort()
        if (sendOSC) {
            try {
                networks.oscOut.send('/audio', audioSource)
            } catch (e) {
                if (DEBUG) console.error('getAudioSourceList -- Failed to send audio source list:', e)
            }
        }
        return audioSource
    } catch (e) {
        if (DEBUG) console.error('getAudioSourceList -- Failed to get source list:', e)
    }
}

async function updateAudioSourceList(networks) {
    try {
        const response = await networks.obs.send('GetSourceTypesList')
        response.types.forEach(type => {
            if (audioSourceList.has(type.typeId)) return
            if (type.caps.hasAudio) {
                audioSourceList.add(type.typeId)
            }
        })
    } catch (e) {
        if (DEBUG) console.error('updateAudioSourceList -- Failed to get source type list:', e)
    }
}

async function getSourceVolume(networks, source) {
    const volumePath = `/audio/${source}/volume`
    const mutePath = `/audio/${source}/mute`
    if (networks.miscConfig.useDbForVolume) {
        try {
            const response = await networks.obs.send('GetVolume', { source: source, useDecibel: true })
            networks.oscOut.send(volumePath, response.volume)
            networks.oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`getSourceVolume - Failed to get volume (dB) of source ${source}:`, e)
        }
    } else {
        try {
            const response = await networks.obs.send('GetVolume', { source: source })
            networks.oscOut.send(volumePath, response.volume)
            networks.oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`getSourceVolume - Failed to get volume of source ${source}:`, e)
        }
    }
}

async function setSourceVolume(networks, source, volume) {
    if (networks.miscConfig.useDbForVolume) {
        const volumeDb = (volume * 100) - 100
        try {
            await networks.obs.send('SetVolume', { source: source, volume: volumeDb, useDecibel: true })
        } catch (e) {
            if (DEBUG) console.error(`setSourceVolume - Failed to set volume (dB) for source ${source}:`, e)
        }
    } else {
        try {
            await networks.obs.send('SetVolume', { source: source, volume: volume })
        } catch (e) {
            if (DEBUG) console.error(`setSourceVolume - Failed to set volume for source ${source}:`, e)
        }
    }
}

async function getSourceMuteState(networks, source) {
    const mutePath = `/audio/${source}/mute`
    try {
        const response = await networks.obs.send('GetMute', { source: source })
        try {
            networks.oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`getSourceMuteState -- Failed to send mute state of source ${source}:`, e)
        }
    } catch (e) {
        if (DEBUG) console.error(`getSourceMuteState -- Failed to get mute state from scene ${source}:`, e)
    }
}

async function setSourceMuteState(networks, source, state) {
    try {
        await networks.obs.send('SetMute', { source: source, mute: state ? true : false })
    } catch {
        if (DEBUG) console.error(`setSourceMuteState -- Failed to set mute state from scene ${source}:`, e)
    }
}

async function getSpecialSourceList(networks, sendOSC = true) {
    const specialAudioPath = `/specialAudio`
    try {
        const response = await networks.obs.send('GetSpecialSources')
        const specialSourceList = []
        const regex = /(desktop|mic)\-\d/g
        for (const key in response) {
            if (key.match(regex)) specialSourceList.push(response[key])
        }

        if (sendOSC) {
            try {
                networks.oscOut.send(specialAudioPath, specialSourceList)
            } catch (e) {
                if (DEBUG) console.error('getSpecialSourceList -- Failed to send special audio source list:', e)
            }
        }

        return specialSourceList
    } catch (e) {
        if (DEBUG) console.error('getSpecialSourceList -- Failed to get special audio source list:', e)
    }

}

async function sendSceneAudioFeedback(networks, response) {
    const sceneAudioPath = `/sceneAudio`
    const specialAudioSource = await getSpecialSourceList(networks, false)
    let sceneAudioSource = []

    response.sources.forEach(source => {
        // Note: Use source.type instead of source.typeId here, probably a typo in OSBWebSocket (or .js)
        if (audioSourceList.has(source.type) && !specialAudioSource.includes(source.name)) {
            sceneAudioSource.push(source.name)
        }
    })

    sceneAudioSource.sort()
    sceneAudioSource = [...specialAudioSource, ...sceneAudioSource]
    if (DEBUG) console.info('Scene audio list:', sceneAudioSource)
    try {
        networks.oscOut.send(sceneAudioPath, response.sceneName ? response.sceneName : response.name ? response.name : '', sceneAudioSource)
    } catch (e) {
        if (DEBUG) console.error('sendSceneAudioFeedback -- Failed to send scene audio feedback:', e)
    }
}

function sendAudioVolumeFeedback(networks, response) {
    const volumePath = `/audio/${response.sourceName}/volume`
    try {
        if (networks.miscConfig.useDbForVolume === true) {
            networks.oscOut.send(volumePath, response.volumeDb)
        } else {
            networks.oscOut.send(volumePath, response.volume)
        }
    } catch (e) {
        if (DEBUG) console.error(`sendAudioVolumeFeedback -- Failed to send audio volume${(networks.miscConfig.useDbForVolume === true) ? ' (dB)' : ''} feedback for ${response.sourceName}:`, e)
    }
}

function sendAudioMuteFeedback(networks, response) {
    const mutePath = `/audio/${response.sourceName}/mute`
    try {
        networks.oscOut.send(mutePath, response.muted ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error(`sendAudioMuteFeedback -- Failed to send mute state of source ${response.sourceName}:`, e)
    }
}
