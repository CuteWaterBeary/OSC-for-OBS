const { BrowserWindow } = require('electron')
const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC, setUpOBSOSC, syncMiscConfig }

let obs
let oscIn
let oscOut

let miscConfig = {}
let isClosedManually = true

function syncMiscConfig(config) {
    console.info('Misc config synced')
    miscConfig = config
}

async function connectOBS(config) {
    console.info('Connecting OBSWebSocket...')
    console.info(`ip: ${config.ip}, port: ${config.port}, password: ${config.password}`)
    if (obs) {
        console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist', at: 'OBS WebSocket' }
    }

    obs = new OBSWebSocket()
    try {
        const address = config.ip + ':' + config.port
        await obs.connect({ address: address, password: config.password })
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        console.error('OBSWebSocket error:', err)
    })

    obs.on('ConnectionClosed', async () => {
        console.info('OBSWebSocket is closed')
        if (!isClosedManually) {
            async function reconnectOBS(config) {
                try {
                    console.info('Reconnecting OBSWebSocket...')
                    const address = config.ip + ':' + config.port
                    await obs.connect({ address: address, password: config.password })
                    console.info('Reconnecting OBSWebSocket...Succeeded')
                } catch (e) {
                    console.error('Reconnecting failed:', e)
                }
            }

            setTimeout(reconnectOBS, 1500, config)
        } else {
            const mainWindow = BrowserWindow.fromId(config.mainWindowId)
            if (mainWindow) {
                mainWindow.webContents.send('disconnect:cancel')
                console.warn('Connections canceled')
            }
        }
    })

    if (config.autoReconnect) {
        isClosedManually = false
    }
    console.info('Connecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function disconnectOBS() {
    console.info('Disconnecting OBSWebSocket...')
    if (obs === null) {
        console.error('OBSWebSocket did not exist')
    }

    try {
        await obs.disconnect()
    } catch (e) {
        console.error('OBSWebSocket error:', e)
    }

    obs = null
    isClosedManually = true
    console.info('Disconnecting OBSWebSocket...Succeeded')
}

async function connectOSC(oscInConfig, oscOutConfig) {
    try {
        oscIn = new Server(oscInConfig.port, oscInConfig.ip, () => {
            console.info(`OSC server is listening to ${oscInConfig.ip}:${oscInConfig.port}`)
        })
    } catch (e) {
        console.error('Error occurred when starting OSC server:', e)
        return { result: false, error: e, at: 'OSC In' }
    }

    try {
        oscOut = new Client(oscOutConfig.ip, oscOutConfig.port)
        console.info(`OSC client is ready to send to ${oscOutConfig.ip}:${oscOutConfig.port}`)
    } catch (e) {
        console.error('Error occurred when starting OSC client:', e)
        return { result: false, error: e, at: 'OSC Out' }
    }

    return { result: true }
}

async function disconnectOSC() {
    if (oscIn) {
        try {
            oscIn.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC server:', e)
        }
    }

    if (oscOut) {
        try {
            oscOut.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC client:', e)
        }
    }

    oscIn = null
    oscOut = null
    console.info('OSC server/client stopped')
}

async function setUpOBSOSC() {
    if (!oscIn) {
        console.warn('OSC server not available')
        return
    }

    if (!oscOut) {
        console.warn('OSC client not available')
        return
    }

    obs.on('TransitionBegin', (event) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                const sceneName = event.toScene.replaceAll(' ', '_')
                const customPath = `/${miscConfig.useCustomPath.prefix}/${sceneName}${(miscConfig.useCustomPath.suffix !== '') ? '/' + miscConfig.useCustomPath.suffix : ''}`
                oscOut.send(customPath, 1, () => {
                    console.info('Active scene changes (custom path)')
                })
            } else {
                oscOut.send('/activeScene', event.toScene, () => {
                    console.info('Active scene changes')
                })
            }
        }
    })

    obs.on('SwitchScenes', (event) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                return
            }

            oscOut.send('/activeSceneCompleted', event.sceneName, () => {
                console.info('Active scene change completed')
            })
        }
    })

    oscIn.on('message', (message) => {
        console.info('New OSC message:', message)
        processOSCInMessage(message)
    })
}

async function processOSCInMessage(message) {
    if (!Array.isArray(message)) {
        console.error('processOSCInMessage - Wrong message type:', message)
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
        console.warn('Unknown message path:', path)
    }
}

async function setOBSCurrentScene(scene, arg) {
    if (scene && arg === 0) {
        console.info('setOBSCurrentScene - Do nothing')
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
                    console.warn('setOBSCurrentScene - Invalid scene index:', arg)
                    return
                }

                sceneName = sceneList['scenes'][arg]['name']
            } catch (e) {
                console.error('setOBSCurrentScene - Cannot get scene list')
                return
            }
        } else {
            console.error('setOBSCurrentScene - Invalid argument:', arg)
            return
        }
    }

    console.error('setOBSCurrentScene - Trying to change to scene:', sceneName)

    try {
        await obs.send('SetCurrentScene', { 'scene-name': sceneName })
    } catch (e) {
        console.error(`setOBSCurrentScene - Failed to set scene ${sceneName}:`, e)
    }
}
