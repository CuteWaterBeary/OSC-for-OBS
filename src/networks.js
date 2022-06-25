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

    obs.on('SwitchScenes', (response) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                return
            }

            oscOut.send('/activeSceneCompleted', response.sceneName, () => {
                if (DEBUG) console.info('Active scene change completed')
            })
        }
    })

    obs.on('SourceVolumeChanged', (response) => {
        if (miscConfig.useDbForVolume) {
            oscOut.send(`/${response.sourceName}/volume`, response.volumeDb, () => {
                if (DEBUG) console.info('Sending audio volume (dB) feedback for:', response.sourceName)
            })
        } else {
            oscOut.send(`/${response.sourceName}/volume`, response.volume, () => {
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
        await setOBSCurrentScene(path[1], message[1])
    } else if (path[0] === 'go' || path === 'back') {

    } else if (path[1] === 'transition') {
        // Note: path might change later
    } else if (path[2] === 'visible') {

    } else if (path[2] === 'filterVisibility') {

    } else if (path[1] === 'setText') {

    } else if (path[2] === 'opacity') {

    } else if (path[2] === 'gamma') {

    } else if (path[2] === 'contrast') {

    } else if (path[2] === 'brightness') {

    } else if (path[2] === 'saturation') {

    } else if (path[2] === 'hueshift') {

    } else if (path[2] === 'position') {

    } else if (path[2] === 'scale') {

    } else if (path[2] === 'rotate') {

    } else if (path[1] === 'mute') {

    } else if (path[1] === 'unmute') {

    } else if (path[1] === 'audioToggle') {

    } else if (path[1] === 'volume') {
        setSourceVolume(path[0], message[1])
    } else if (path[1] === 'monitorOff') {

    } else if (path[1] === 'monitorOnly') {

    } else if (path[1] === 'monitorAndOutput') {

    } else if (path[1] === 'mediaPlay') {

    } else if (path[1] === 'mediaPause') {

    } else if (path[1] === 'mediaRestart') {

    } else if (path[1] === 'mediaStop') {

    } else if (path[1] === 'refreshBrowser') {

    } else if (path[0] === 'openProjector') {

    } else if (path[0] === 'setStudioMode') {

    } else if (path[0] === 'enableStudioMode') {

    } else if (path[0] === 'disableStudioMode') {

    } else if (path[0] === 'toggleStudioMode') {

    } else if (path[0] === 'previewScene') {

    } else if (path[0] === 'studioTransition') {

    } else if (path[0] === 'setRecording') {

    } else if (path[0] === 'startRecording') {

    } else if (path[0] === 'stopRecording') {

    } else if (path[0] === 'toggleRecording') {

    } else if (path[0] === 'pauseRecording') {

    } else if (path[0] === 'resumeRecording') {

    } else if (path[0] === 'setStreaming') {

    } else if (path[0] === 'startStreaming') {

    } else if (path[0] === 'stopStreaming') {

    } else if (path[0] === 'toggleStreaming') {

    } else if (path[0] === 'setVirtualCam ') {

    } else if (path[0] === 'startVirtualCam') {

    } else if (path[0] === 'stopVirtualCam') {

    } else if (path[0] === 'toggleVirtualCam') {

    } else if (path[0] === 'setSceneCollection') {

    } else if (path[0] === 'setProfile') {

    } else if (path[0] === 'listOutputs') {

    } else if (path[0] === 'startOutput') {

    } else if (path[0] === 'stopOutput') {

    } else if (path[0] === 'rename') {

    } else if (path[0] === 'sendCC') {

    } else if (path[0] === 'recFileName') {

    } else if (path[1] === 'getTextFreetype') {

    } else if (path[1] === 'getTextGDI') {

    } else if (path[1] === 'activeSceneItemVisibility') {

    } else if (path[2] === 'activeSceneItemVisibility') {

    } else if (path[0] === 'takeScreenshot') {

    } else if (path[0] === 'openExternal') {

    } else if (path[0] === 'keypress') {
        // Not implemented
    } else if (path[0] === 'addSceneItem') {

    } else if (path[0] === 'transOverrideType') {

    } else if (path[0] === 'transOverrideDuration') {

    } else if (path[0] === 'size') {

    } else if (path[0] === 'move' || path[0] === 'movex' || path[0] === 'movey') {

    } else if (path[0] === 'align') {

    } else if (path[0] === 'spin') {

    } else if (path[0] === 'fitToScreen') {

    } else if (path[0] === 'duplicateCurrentScene') {

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

async function setSourceVolume(source, volume) {
    if (miscConfig.useDbForVolume) {
        const volumeDb = (volume * 100) - 100
        try {
            await obs.send('SetVolume', { source: source, volume: volumeDb, useDecibel: true})
        } catch (e) {
            if (DEBUG) console.error('setSourceVolume - Failed to set volume (dB) for source:', source)
        }
    } else {
        try {
            await obs.send('SetVolume', { source: source, volume: volume})
        } catch (e) {
            if (DEBUG) console.error('setSourceVolume - Failed to set volume for source:', source)
        }
    }
}
