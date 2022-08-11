const { BrowserWindow } = require('electron')
const OBSWebSocket = require('obs-websocket-js').default
const { EventSubscription, RequestBatchExecutionType } = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

const { processScene, processActiveScene, sendActiveSceneFeedback, sendSceneCompletedFeedback } = require('./obsosc/scene')
const { processSource } = require('./obsosc/source')
const { processSceneItem, sendSceneItemFeedback } = require('./obsosc/sceneItem')
const { updateAudioInputKindList, processSourceAudio, getSceneAudioInputList, sendSceneAudioInputFeedback, sendAudioInputVolumeFeedback, sendAudioMuteFeedback } = require('./obsosc/audio')
const { processRecording, sendRecordingStateFeedback, sendRecordingPauseStateFeedback } = require('./obsosc/recording')
const { processStudioMode, sendStudioModeStateFeedback, sendStudioPreviewSceneFeedback } = require('./obsosc/studio')
const { processVirtualCam, sendVirtualCamStateFeedback } = require('./obsosc/virtualCam')
const { processStreaming, sendStreamingStateFeedback } = require('./obsosc/streaming')
const { processInput } = require('./obsosc/input')
const { processOutput } = require('./obsosc/output')
const { processTransition } = require('./obsosc/transition')
const { processSceneCollection, sendCurrentSceneCollectionFeedback} = require('./obsosc/sceneCollection')
const { processProfile, sendCurrentProfileFeedback} = require('./obsosc/profile')

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
        const address = 'ws://' + config.ip + ':' + config.port
        // Note: Change identificationParams if needed
        const { obsWebSocketVersion, negotiatedRpcVersion } = await obs.connect(address, config.password, { rpcVersion: 1 })
        if (DEBUG) console.error(`OBSWebSocket server version ${obsWebSocketVersion}, RPC version ${negotiatedRpcVersion}`)
    } catch (e) {
        if (DEBUG) console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.message, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        if (DEBUG) console.error('OBSWebSocket error:', err)
    })

    obs.on('ConnectionClosed', async (wsError) => {
        if (DEBUG) console.info('OBSWebSocket is closed:', wsError)
        if (!isConnectionClosedManually) {
            async function reconnectOBS(config) {
                try {
                    if (DEBUG) console.info('Reconnecting OBSWebSocket...')
                    const address = 'ws://' + config.ip + ':' + config.port
                    await obs.connect(address, config.password, { rpcVersion: 1 })
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

// TODO: Fix bug that make this function being called twice when clicking disconnect button
async function disconnectOBS() {
    if (DEBUG) console.info('Disconnecting OBSWebSocket...')
    if (obs === null) {
        if (DEBUG) console.error('OBSWebSocket did not exist')
    }

    isConnectionClosedManually = true
    try {
        // TODO: Add code to remove event listeners if we choose to
        //       reuse OBSWebSocket instead of creating new one every time
        await obs.disconnect()
    } catch (e) {
        if (DEBUG) console.error('OBSWebSocket error:', e)
    }

    obs = null
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
    updateAudioInputKindList({ obs, oscIn, oscOut, miscConfig })

    oscIn.on('message', (message) => {
        if (DEBUG) console.info('New OSC message:', message)
        processOSCInMessage(message)
    })
}

async function setUpOBSWebSocketListener() {
    const networks = { obs, oscIn, oscOut, miscConfig }

    // TODO: Add back custom path support
    obs.on('SceneTransitionStarted', async () => {
        if (!miscConfig.notifyActiveScene) return
        sendActiveSceneFeedback(networks)
    })

    // TODO: Add requests for additional scene item/audio source info
    obs.on('CurrentProgramSceneChanged', async ({ sceneName }) => {
        if (!miscConfig.notifyActiveScene) return
        sendSceneCompletedFeedback(networks, sceneName)
        if (miscConfig.notifySceneInputs) {
            sendSceneAudioInputFeedback(networks, sceneName)
        }
        if (miscConfig.notifySceneItems) {
            sendSceneItemFeedback(networks, sceneName)
        }
    })

    // obs.once('InputVolumeMeters', response => {
    //     console.info(response)
    // })


    obs.on('InputVolumeChanged', ({ inputName, inputVolumeMul, inputVolumeDb }) => {
        if (!miscConfig.notifyVolumeChange) return
        sendAudioInputVolumeFeedback(networks, inputName, inputVolumeMul, inputVolumeDb)
    })

    obs.on('InputMuteStateChanged', ({ inputName, inputMuted }) => {
        if (!miscConfig.notifyMuteState) return
        sendAudioMuteFeedback(networks, inputName, inputMuted)
    })

    obs.on('VirtualcamStateChanged', ({ outputActive }) => {
        if (!miscConfig.notifyVirtualCamState) return
        sendVirtualCamStateFeedback(networks, outputActive ? 1 : 0)
    })

    obs.on('StreamStateChanged', ({ outputState }) => {
        if (!miscConfig.notifyStreamingState) return
        if (outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED') {
            sendStreamingStateFeedback(networks, 1)
        } else if (outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
            sendStreamingStateFeedback(networks, 0)
        }
    })

    obs.on('RecordStateChanged', ({ outputState }) => {
        if (!notifyRecordingState.notifyRecordingState) return
        if (outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED') {
            sendRecordingStateFeedback(networks, 1)
        } else if (outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
            sendRecordingPauseStateFeedback(networks, 1)
        } else if (outputState === 'OBS_WEBSOCKET_OUTPUT_RESUMED') {
            sendRecordingPauseStateFeedback(networks, 0)
        } else if (outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
            sendRecordingStateFeedback(networks, 0)
        }
    })


    obs.on('StudioModeStateChanged', ({ studioModeEnabled }) => {
        if (!miscConfig.notifyStudioModeState) return
        sendStudioModeStateFeedback(networks, studioModeEnabled)
    })

    obs.on('CurrentPreviewSceneChanged', ({ sceneName }) => {
        if (!miscConfig.notifyStudioPreviewScene) return
        sendStudioPreviewSceneFeedback(networks, sceneName)
    })

    obs.on('CurrentProfileChanged', ({profileName}) => {
        if (!miscConfig.notifyCurrentProfile) return
        sendCurrentProfileFeedback(networks, profileName)
    })
    
    obs.on('CurrentSceneCollectionChanged', ({sceneCollectionName}) => {
        if (!miscConfig.notifyCurrentSceneCollection) return
        sendCurrentSceneCollectionFeedback(networks, sceneCollectionName)
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
    if (path.at(-1) === '') path.pop()

    if (path[0] === 'scene') {
        processScene(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'activeScene') {
        processActiveScene(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'source') {
        processSource(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneItem') {
        processSceneItem(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'input') {
        processInput(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'audio') {
        processSourceAudio(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneAudio') {
        getSceneAudioInputList(networks)
    } else if (path[0] === 'studio') {
        processStudioMode(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'transition') {
        processTransition(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'recording') {
        processRecording(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'streaming') {
        processStreaming(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'virtualCam') {
        processVirtualCam(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'output') {
        processOutput(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'media') {
        
    } else if (path[0] === 'profile') {
        processProfile(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneCollection') {
        processSceneCollection(networks, path.slice(1), message.slice(1))
    } else if (path[0] === 'misc') {

    } else {
        if (DEBUG) console.warn('Unknown message path:', path.join('/'))
    }
}
