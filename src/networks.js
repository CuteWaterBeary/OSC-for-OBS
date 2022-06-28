const { BrowserWindow } = require('electron')
const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC, setUpOBSOSC, syncMiscConfig }

const DEBUG = process.argv.includes('--enable-log')

let obs
let oscIn
let oscOut

let miscConfig = {}
let isClosedManually = true

let audioSourceList = new Set()

function syncMiscConfig(config) {
    if (DEBUG) console.info('Misc config synced')
    miscConfig = config
}

async function connectOBS(config) {
    if (DEBUG) console.info('Connecting OBSWebSocket...')
    if (DEBUG) console.info(`ip: ${config.ip}, port: ${config.port}, password: ${config.password}`)
    if (obs) {
        if (DEBUG) console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist', at: 'OBS WebSocket' }
    }

    obs = new OBSWebSocket()
    try {
        const address = config.ip + ':' + config.port
        await obs.connect({ address: address, password: config.password })
    } catch (e) {
        if (DEBUG) console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        if (DEBUG) console.error('OBSWebSocket error:', err)
    })

    obs.on('ConnectionClosed', async () => {
        if (DEBUG) console.info('OBSWebSocket is closed')
        if (!isClosedManually) {
            async function reconnectOBS(config) {
                try {
                    if (DEBUG) console.info('Reconnecting OBSWebSocket...')
                    const address = config.ip + ':' + config.port
                    await obs.connect({ address: address, password: config.password })
                    if (DEBUG) console.info('Reconnecting OBSWebSocket...Succeeded')
                } catch (e) {
                    if (DEBUG) console.error('Reconnecting failed:', e)
                }
            }

            setTimeout(reconnectOBS, 1500, config)
        } else {
            const mainWindow = BrowserWindow.fromId(config.mainWindowId)
            if (mainWindow) {
                mainWindow.webContents.send('disconnect:cancel')
                if (DEBUG) console.warn('Connections canceled')
            }
        }
    })

    if (config.autoReconnect) {
        isClosedManually = false
    }
    if (DEBUG) console.info('Connecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function disconnectOBS() {
    if (DEBUG) console.info('Disconnecting OBSWebSocket...')
    if (obs === null) {
        if (DEBUG) console.error('OBSWebSocket did not exist')
    }

    try {
        await obs.disconnect()
    } catch (e) {
        if (DEBUG) console.error('OBSWebSocket error:', e)
    }

    obs = null
    isClosedManually = true
    if (DEBUG) console.info('Disconnecting OBSWebSocket...Succeeded')
}

async function connectOSC(oscInConfig, oscOutConfig) {
    try {
        oscIn = new Server(oscInConfig.port, oscInConfig.ip, () => {
            if (DEBUG) console.info(`OSC server is listening to ${oscInConfig.ip}:${oscInConfig.port}`)
        })
    } catch (e) {
        if (DEBUG) console.error('Error occurred when starting OSC server:', e)
        return { result: false, error: e, at: 'OSC In' }
    }

    try {
        oscOut = new Client(oscOutConfig.ip, oscOutConfig.port)
        if (DEBUG) console.info(`OSC client is ready to send to ${oscOutConfig.ip}:${oscOutConfig.port}`)
    } catch (e) {
        if (DEBUG) console.error('Error occurred when starting OSC client:', e)
        return { result: false, error: e, at: 'OSC Out' }
    }

    return { result: true }
}

async function disconnectOSC() {
    if (oscIn) {
        try {
            oscIn.close()
        } catch (e) {
            if (DEBUG) console.error('Error occurred when stopping OSC server:', e)
        }
    }

    if (oscOut) {
        try {
            oscOut.close()
        } catch (e) {
            if (DEBUG) console.error('Error occurred when stopping OSC client:', e)
        }
    }

    oscIn = null
    oscOut = null
    if (DEBUG) console.info('OSC server/client stopped')
}

async function setUpOBSOSC() {
    if (!oscIn) {
        if (DEBUG) console.warn('OSC server not available')
        return
    }

    if (!oscOut) {
        if (DEBUG) console.warn('OSC client not available')
        return
    }

    setUpOBSWebSocketListener()
    getAudioSourceList()

    oscIn.on('message', (message) => {
        if (DEBUG) console.info('New OSC message:', message)
        processOSCInMessage(message)
    })
}

async function setUpOBSWebSocketListener() {
    obs.on('TransitionBegin', (response) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                const sceneName = response.toScene.replaceAll(' ', '_')
                const customPath = `/${miscConfig.useCustomPath.prefix}/${sceneName}${(miscConfig.useCustomPath.suffix !== '') ? '/' + miscConfig.useCustomPath.suffix : ''}`
                oscOut.send(customPath, 1, () => {
                    if (DEBUG) console.info('Active scene changes (custom path)')
                })
            } else {
                oscOut.send('/activeScene', response.toScene, () => {
                    if (DEBUG) console.info('Active scene changes')
                })
            }
        }
    })

    obs.on('SwitchScenes', async (response) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                return
            }

            oscOut.send('/activeSceneCompleted', response.sceneName, () => {
                if (DEBUG) console.info('Active scene change completed')
            })

            const globalAudioSource = await getGlobalAudioSourceList()
            let sceneAudioSource = []

            // if (DEBUG) console.info(response.sources)
            response.sources.forEach(source => {
                // Note: Use source.type instead of source.typeId here, probably a typo in OSBWebSocket (or .js)
                if (audioSourceList.has(source.type) && !globalAudioSource.includes(source.name)) {
                    sceneAudioSource.push(source.name)
                }
            })

            sceneAudioSource.sort()
            if (DEBUG) console.info('Scene audio list:', sceneAudioSource)
            sceneAudioSource = [...globalAudioSource, ...sceneAudioSource]
            // const sceneAudioPath = `/scene/${response.sceneName}/audio`
            // const sceneAudioPath = `/sceneAudio/${response.sceneName}`
            const sceneAudioPath = `/sceneAudio`
            oscOut.send(sceneAudioPath, response.sceneName, sceneAudioSource)
        }
    })

    obs.on('SourceVolumeChanged', (response) => {
        const volumePath = `/audio/${response.sourceName}/volume`
        if (miscConfig.useDbForVolume) {
            oscOut.send(volumePath, response.volumeDb, () => {
                if (DEBUG) console.info('Sending audio volume (dB) feedback for:', response.sourceName)
            })
        } else {
            oscOut.send(volumePath, response.volume, () => {
                if (DEBUG) console.info('Sending audio volume feedback for:', response.sourceName)
            })
        }
    })
}

async function processOSCInMessage(message) {
    if (!Array.isArray(message)) {
        if (DEBUG) console.error('processOSCInMessage - Wrong message type:', message)
        return
    }

    const path = message[0].split('/')
    path.shift()

    if (path[0] === 'scene') {
        setOBSCurrentScene(path[1], message[1])
    } else if (path[0] === 'source') {

    } else if (path[0] === 'audio') {
        setSourceAudio(path.slice(1), message[1])
    } else if (path[0] === 'media') {

    } else if (path[0] === 'profile') {

    } else if (path[0] === 'record') {

    } else if (path[0] === 'sceneCollection') {

    } else if (path[0] === 'stream') {

    } else if (path[0] === 'studio') {

    } else if (path[0] === 'transition') {

    } else if (path[0] === 'virtualCam') {

    } else if (path[0] === 'output') {

    } else if (path[0] === 'misc') {

    } else {
        if (DEBUG) console.warn('Unknown message path:', path)
    }
}

async function setOBSCurrentScene(scene, arg) {
    if (scene && arg === 0) {
        if (DEBUG) console.info('setOBSCurrentScene - Do nothing')
        return
    }

    let sceneName
    if (scene) {
        sceneName = scene.replaceAll('_', ' ')
    } else {
        if (typeof (arg) === 'string') {
            sceneName = arg.replaceAll('_', ' ')
        } else if (typeof (arg) === 'number') {
            try {
                const sceneList = await obs.send('GetSceneList')
                if (!sceneList['scenes'][arg]) {
                    if (DEBUG) console.warn('setOBSCurrentScene - Invalid scene index:', arg)
                    return
                }

                sceneName = sceneList['scenes'][arg]['name']
            } catch (e) {
                if (DEBUG) console.error('setOBSCurrentScene - Cannot get scene list')
                return
            }
        } else {
            if (DEBUG) console.error('setOBSCurrentScene - Invalid argument:', arg)
            return
        }
    }

    if (DEBUG) console.error('setOBSCurrentScene - Trying to change to scene:', sceneName)

    try {
        await obs.send('SetCurrentScene', { 'scene-name': sceneName })
    } catch (e) {
        if (DEBUG) console.error(`setOBSCurrentScene - Failed to set scene ${sceneName}:`, e)
    }
}

async function setSourceAudio(path, arg) {
    if (!path[0]) {
        if (!arg) {
            getAudioSourceList()
            return
        }

        if (DEBUG) console.info('setSourceAudio -- Use argement as scene to get volume from OBSWebSocket')
        getSourceVolume(arg)
        return
    }

    if (path[1] === 'volume') {
        const source = path[0]
        if (arg === undefined) {
            console.info('setSourceAudio -- No argument given, get volume from OBSWebSocket')
            getSourceVolume(source)
            return
        }

        setSourceVolume(source, arg)
    }
}

async function getAudioSourceList() {
    try {
        const response = await obs.send('GetSourceTypesList')
        response.types.forEach(type => {
            // if (DEBUG) console.info(`${type.displayName} - ${type.type} : ${type.typeId}:`, type.caps)
            if (audioSourceList.has(type.typeId)) return
            if (type.caps.hasAudio) {
                audioSourceList.add(type.typeId)
            }
        })
    } catch (e) {
        if (DEBUG) console.error('getAudioSourceList -- Failed to get source type list:', e)
        return
    }

    try {
        const response = await obs.send('GetSourcesList')
        if (DEBUG) console.info('Source list:', response)
        const audioSource = []
        response.sources.forEach(source => {
            if (audioSourceList.has(source.typeId)) {
                audioSource.push(source.name)
            }
        })

        audioSource.sort()
        if (DEBUG) console.info('Audio source list:', audioSource)
        oscOut.send('/audio', audioSource)
        return audioSource
    } catch (e) {
        if (DEBUG) console.error('getAudioSourceList -- Failed to get source list:', e)
    }
}


async function getGlobalAudioSourceList() {
    try {
        const response = await obs.send('GetSourceTypesList')
        response.types.forEach(type => {
            if (audioSourceList.has(type.typeId)) return
            if (type.caps.hasAudio) {
                audioSourceList.add(type.typeId)
            }
        })
    } catch (e) {
        if (DEBUG) console.error('getGlobalAudioSourceList -- Failed to get source type list:', e)
        return
    }

    try {
        const response = await obs.send('GetSourcesList')
        const globalAudioSource = []
        const audioRegex = /^(\w+_){1,}(input|output)_capture$/
        response.sources.forEach(source => {
            if (audioSourceList.has(source.typeId) && source.typeId.match(audioRegex)) {
                globalAudioSource.push(source.name)
            }
        })

        globalAudioSource.sort()
        // if (DEBUG) console.info('Glogal audio source list:', globalAudioSource)
        // oscOut.send('/globalAudio', globalAudioSource)
        return globalAudioSource
    } catch (e) {
        if (DEBUG) console.error('getGlobalAudioSourceList -- Failed to get source list:', e)
    }
}

async function getSourceVolume(source) {
    if (miscConfig.useDbForVolume) {
        try {
            const response = await obs.send('GetVolume', { source: source, useDecibel: true })
            oscOut.send(`/audio/${source}/volume`, response.volume)
        } catch (e) {
            if (DEBUG) console.error(`getSourceVolume - Failed to get volume (dB) of source ${source}:`, e)
        }
    } else {
        try {
            const response = await obs.send('GetVolume', { source: source })
            oscOut.send(`/audio/${source}/volume`, response.volume)
        } catch (e) {
            if (DEBUG) console.error(`getSourceVolume - Failed to get volume of source ${source}:`, e)
        }
    }
}

async function setSourceVolume(source, volume) {
    if (miscConfig.useDbForVolume) {
        const volumeDb = (volume * 100) - 100
        try {
            await obs.send('SetVolume', { source: source, volume: volumeDb, useDecibel: true })
        } catch (e) {
            if (DEBUG) console.error(`setSourceVolume - Failed to set volume (dB) for source ${source}:`, e)
        }
    } else {
        try {
            await obs.send('SetVolume', { source: source, volume: volume })
        } catch (e) {
            if (DEBUG) console.error(`setSourceVolume - Failed to set volume for source ${source}:`, e)
        }
    }
}
