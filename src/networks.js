const { BrowserWindow } = require('electron')
const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

const { processScene, getCurrentScene, setCurrentScene, sendActiveSceneFeedback, sendCustomActiveSceneFeedback, sendSceneCompletedFeedback } = require('./obsosc/scene')
const { processSource } = require('./obsosc/source')
const { processSceneItem } = require('./obsosc/sceneItem')
const { processSourceAudio, getAudioSourceList, sendSceneAudioFeedback, sendAudioVolumeFeedback, sendAudioMuteFeedback } = require('./obsosc/audio')
const { processRecording, sendRecordingStateFeedback, sendRecordingPauseStateFeedback } = require('./obsosc/recording')
const { processStudioMode, sendStudioModeStateFeedback, sendStudioPreviewSceneFeedback } = require('./obsosc/studio')
const { processVirtualCam, sendVirtualCamStateFeedback } = require('./obsosc/virtualCam')
const { processOutput } = require('./obsosc/output')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC, setUpOBSOSC, syncMiscConfig }

const DEBUG = process.argv.includes('--enable-log')

let obs
let oscIn
let oscOut

let miscConfig = {}
let isConnectionClosedManually = true

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
        if (!isConnectionClosedManually) {
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
                if (DEBUG) console.warn('Connections stopped/canceled')
            }
        }
    })

    if (config.autoReconnect) {
        isConnectionClosedManually = false
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
    isConnectionClosedManually = true
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
    getAudioSourceList({ obs, oscIn, oscOut, miscConfig })

    oscIn.on('message', (message) => {
        if (DEBUG) console.info('New OSC message:', message)
        processOSCInMessage(message)
    })
}

async function setUpOBSWebSocketListener() {
    const networks = { obs, oscIn, oscOut, miscConfig }

    obs.on('TransitionBegin', (response) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                sendCustomActiveSceneFeedback(networks, response)
            } else {
                sendActiveSceneFeedback(networks, response)
            }
        }
    })

    obs.on('SwitchScenes', async (response) => {
        if (miscConfig.notifyActiveScene) {
            if (miscConfig.useCustomPath && miscConfig.useCustomPath.enabled === true) {
                return
            }

            sendSceneCompletedFeedback(networks, response)
            sendSceneAudioFeedback(networks, response)
        }
    })

    obs.on('SourceVolumeChanged', (response) => {
        sendAudioVolumeFeedback(networks, response)
    })

    obs.on('SourceMuteStateChanged', (response) => {
        sendAudioMuteFeedback(networks, response)
    })

    obs.on('VirtualCamStarted', () => {
        sendVirtualCamStateFeedback(networks, 1)
    })

    obs.on('VirtualCamStopped', () => {
        sendVirtualCamStateFeedback(networks, 0)
    })

    obs.on('RecordingStarted', () => {
        sendRecordingStateFeedback(networks, 1)
    })

    obs.on('RecordingStopped', () => {
        sendRecordingStateFeedback(networks, 0)
    })

    obs.on('RecordingPaused', () => {
        sendRecordingPauseStateFeedback(networks, 1)
    })

    obs.on('RecordingResumed', () => {
        sendRecordingPauseStateFeedback(networks, 0)
    })

    obs.on('StudioModeSwitched', (response) => {
        sendStudioModeStateFeedback(networks, response)
    })

    obs.on('PreviewSceneChanged', (response) => {
        sendStudioPreviewSceneFeedback(networks, response)
    })
}

async function processOSCInMessage(message) {
    const networks = { obs, oscIn, oscOut, miscConfig }

    if (!Array.isArray(message)) {
        if (DEBUG) console.error('processOSCInMessage - Wrong message type:', message)
        return
    }

    const path = message[0].split('/')
    path.shift()

    if (path[0] === 'scene') {
        processScene(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'activeScene') {
        if (message[1]) {
            setCurrentScene(networks, message[1])
        } else {
            getCurrentScene(networks)
        }
    } else if (path[0] === 'source') {
        processSource(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneItem') {
        processSceneItem(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'audio') {
        processSourceAudio(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'media') {

    } else if (path[0] === 'profile') {

    } else if (path[0] === 'recording') {
        processRecording(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneCollection') {

    } else if (path[0] === 'stream') {

    } else if (path[0] === 'studio') {
        processStudioMode(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'transition') {

    } else if (path[0] === 'virtualCam') {
        processVirtualCam(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'output') {
        processOutput(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'misc') {

    } else if (path[0] === 'sceneAudio') {

    } else if (path[0] === 'sceneSource') {

    } else if (path[0] === 'misc') {

    } else {
        if (DEBUG) console.warn('Unknown message path:', path.join('/'))
    }
}
