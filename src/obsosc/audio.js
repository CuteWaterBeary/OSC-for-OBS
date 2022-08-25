const { getCurrentProgramScene } = require('./scene')
const { getSceneItemList } = require('./sceneItem')
const { getInputList } = require('./input')

if (process.argv.includes('--unit-test')) {
    module.exports = { processSourceAudio, getAudioInputList, updateAudioInputKindList, getInputVolume, setInputVolume, getInputMute, setInputMute, getSpecialInputs, getSceneAudioInputList, sendSceneAudioInputFeedback, sendAudioInputVolumeFeedback, sendAudioMuteFeedback }
} else {
    module.exports = { updateAudioInputKindList, processSourceAudio, getAudioInputList, getSceneAudioInputList, sendSceneAudioInputFeedback, sendAudioInputVolumeFeedback, sendAudioMuteFeedback }
}

const DEBUG = process.argv.includes('--enable-log')

let audioInputKindList = new Set()
let otherInputKindList = new Set()

// TODO: Change updateAudioInputKindList when OBSWebSocket provide more suitable API
// TODO: Remove audio capability checking via GetInputVolume in getAudioInputList and
//       updateAudioInputKindList when OBSWebSocket provide more suitable API

async function processSourceAudio(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getAudioInputList(networks)
        } else {
            getInputVolume(networks, args[0])
            getInputVolume(networks, args[0], true)
            getInputMute(networks, args[0])
        }
        return
    }

    if (path[1] === 'volume') {
        if (args[0] === undefined) {
            getInputVolume(networks, path[0])
        } else {
            setInputVolume(networks, path[0], args[0])
        }
    } else if (path[1] === 'volumeDb') {
        if (args[0] === undefined) {
            getInputVolume(networks, path[0], true)
        } else {
            setInputVolume(networks, path[0], args[0], true)
        }
    } else if (path[1] === 'mute') {
        if (args[0] === undefined) {
            getInputMute(networks, path[0])
        } else {
            setInputMute(networks, path[0], args[0])
        }
    }
}

async function getAudioInputList(networks, sendOSC = true) {
    const inputListPath = '/audio'
    const inputList = await getInputList(networks, false)
    const audioInputList = []

    await Promise.all(inputList.map(async input => {
        if (otherInputKindList.has(input.inputKind)) return
        if (audioInputKindList.has(input.inputKind)) {
            audioInputList.push(input)
        } else {
            try {
                await networks.obs.call('GetInputVolume', { inputName: input.inputName })
                audioInputList.push(input)
                audioInputKindList.add(input.inputKind)
            } catch {
                otherInputKindList.add(input.inputKind)
            }
        }
    }))

    if (sendOSC) {
        try {
            networks.oscOut.send(inputListPath, audioInputList.flatMap(input => input.inputName))
        } catch (e) {
            if (DEBUG) console.error('getInputList -- Failed to send input list:', e)
        }
    }

    return audioInputList
}

async function updateAudioInputKindList(networks) {
    const inputList = await getInputList(networks, false)
    for (const input of inputList) {
        try {
            await networks.obs.call('GetInputVolume', { inputName: input.inputName })
            audioInputKindList.add(input.inputKind)
        } catch (e) {
            otherInputKindList.add(input.inputKind)
        }
    }
}

async function getInputVolume(networks, inputName, useVolumeDb = false, sendOSC = true) {
    const volumePath = `/audio/${inputName}/volume`
    const volumeDbPath = `/audio/${inputName}/volumeDb`
    try {
        const { inputVolumeMul, inputVolumeDb } = await networks.obs.call('GetInputVolume', { inputName })
        if (sendOSC) {
            try {
                if (useVolumeDb) {
                    networks.oscOut.send(volumeDbPath, inputVolumeDb)
                } else {
                    networks.oscOut.send(volumePath, inputVolumeMul)
                }
            } catch (e) {
                if (DEBUG) console.error(`getInputVolume - Failed to send volume ${useVolumeDb ? '(dB)' : '(mul)'} of input ${inputName}:`, e)
            }
        }

        return { inputVolumeMul, inputVolumeDb }
    } catch (e) {
        if (DEBUG) console.error(`getInputVolume - Failed to get volume of input ${inputName}:`, e)
    }
}

async function setInputVolume(networks, inputName, inputVolume, useVolumeDb = false) {
    if (useVolumeDb) {
        try {
            await networks.obs.call('SetInputVolume', { inputName, inputVolumeDb: inputVolume })
        } catch (e) {
            if (DEBUG) console.error(`setInputVolume - Failed to set volume (dB) for input ${inputName}:`, e)
        }
    } else {
        try {
            await networks.obs.call('SetInputVolume', { inputName, inputVolumeMul: inputVolume })
        } catch (e) {
            if (DEBUG) console.error(`setInputVolume - Failed to set volume for input ${inputName}:`, e)
        }
    }
}

async function getInputMute(networks, inputName, sendOSC = true) {
    const mutePath = `/audio/${inputName}/mute`
    try {
        const { inputMuted } = await networks.obs.call('GetInputMute', { inputName })
        if (sendOSC) {
            try {
                networks.oscOut.send(mutePath, inputMuted ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error(`getInputMute -- Failed to send mute state of input ${inputName}:`, e)
            }
        }

        return inputMuted
    } catch (e) {
        if (DEBUG) console.error(`getInputMute -- Failed to get mute state from input ${inputName}:`, e)
    }
}

async function setInputMute(networks, inputName, state) {
    try {
        await networks.obs.call('SetInputMute', { inputName, inputMuted: state ? true : false })
    } catch (e) {
        if (DEBUG) console.error(`setInputMute -- Failed to set mute state from input ${inputName}:`, e)
    }
}

async function getSpecialInputs(networks, sendOSC = true) {
    const specialInputPath = `/specialAudio`
    try {
        const response = await networks.obs.call('GetSpecialInputs')
        const specialInputList = []
        for (const key in response) {
            if (response[key] !== null) specialInputList.push(response[key])
        }

        if (sendOSC) {
            try {
                networks.oscOut.send(specialInputPath, specialInputList)
            } catch (e) {
                if (DEBUG) console.error('getSpecialSourceList -- Failed to send special audio source list:', e)
            }
        }

        return specialInputList
    } catch (e) {
        if (DEBUG) console.error('getSpecialSourceList -- Failed to get special audio source list:', e)
    }

}

async function getSceneAudioInputList(networks, sceneName, sendOSC = true) {
    const sceneAudioPath = `/sceneAudio`
    const specialAudioInputs = await getSpecialInputs(networks, false)
    let sceneAudioInputs = []

    if (sceneName === undefined) {
        sceneName = await getCurrentProgramScene(networks, false)
    }

    const sceneItems = await getSceneItemList(networks, sceneName, false)
    await Promise.all(sceneItems.map(async sceneItem => {
        if (sceneItem.inputKind === null) return
        if (otherInputKindList.has(sceneItem.inputKind)) return
        if (audioInputKindList.has(sceneItem.inputKind)) {
            sceneAudioInputs.push(sceneItem.sourceName)
        } else {
            try {
                await networks.obs.call('GetInputVolume', { inputName: sceneItem.sourceName })
                sceneAudioInputs.push(sceneItem.sourceName)
                audioInputKindList.add(sceneItem.inputKind)
            } catch {
                otherInputKindList.add(sceneItem.inputKind)
            }
        }
    }))

    sceneAudioInputs = [...specialAudioInputs, ...sceneAudioInputs]
    sceneAudioInputs.sort()
    if (DEBUG) console.info('Scene audio list:', sceneAudioInputs)
    if (sendOSC) {
        try {
            networks.oscOut.send(sceneAudioPath, sceneAudioInputs)
        } catch (e) {
            if (DEBUG) console.error('sendSceneAudioInputFeedback -- Failed to send scene audio feedback:', e)
        }
    }

    return sceneAudioInputs
}

async function sendSceneAudioInputFeedback(networks, sceneName) {
    await getSceneAudioInputList(networks, sceneName)
}

function sendAudioInputVolumeFeedback(networks, inputName, inputVolumeMul, inputVolumeDb) {
    const volumePath = `/audio/${inputName}/volume`
    const volumeDbPath = `/audio/${inputName}/volumeDb`
    try {
        networks.oscOut.send(volumePath, inputVolumeMul)
        if (networks.miscConfig.enableVolumeDbOutput === true) {
            networks.oscOut.send(volumeDbPath, inputVolumeDb)
        }
    } catch (e) {
        if (DEBUG) console.error(`sendAudioInputVolumeFeedback -- Failed to send audio volume feedback for ${inputName}:`, e)
    }
}

function sendAudioMuteFeedback(networks, inputName, inputMuted) {
    const mutePath = `/audio/${inputName}/mute`
    try {
        networks.oscOut.send(mutePath, inputMuted ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error(`sendAudioMuteFeedback -- Failed to send mute state of input ${inputName}:`, e)
    }
}
