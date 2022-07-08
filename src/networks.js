const { BrowserWindow } = require('electron')
const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC, setUpOBSOSC, syncMiscConfig }

const DEBUG = process.argv.includes('--enable-log')
const keywords = {
    scene: [],
    source: [],
    sceneItem: ['property', 'show', 'hide', 'reset']
}

let obs
let oscIn
let oscOut

let miscConfig = {}
let isConnectionClosedManually = true

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
                const customPath = `/${miscConfig.useCustomPath.prefix}/${response.toScene}${(miscConfig.useCustomPath.suffix !== '') ? '/' + miscConfig.useCustomPath.suffix : ''}`
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
            sceneAudioSource = [...globalAudioSource, ...sceneAudioSource]
            if (DEBUG) console.info('Scene audio list:', sceneAudioSource)
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

    obs.on('SourceMuteStateChanged', (response) => {
        const mutePath = `/audio/${response.sourceName}/mute`
        try {
            oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send mute state of source ${response.sourceName}:`, e)
        }
    })

    obs.on('VirtualCamStarted', () => {
        const virtualCamPath = `/virtualCam`
        try {
            oscOut.send(virtualCamPath, 1)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send started state of virtual camera:`, e)
        }
    })

    obs.on('VirtualCamStopped', () => {
        const virtualCamPath = `/virtualCam`
        try {
            oscOut.send(virtualCamPath, 0)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send stopped state of virtual camera:`, e)
        }
    })

    obs.on('RecordingStarted', () => {
        const recordingPath = `/recording`
        try {
            oscOut.send(recordingPath, 1)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send started state of recording:`, e)
        }
    })

    obs.on('RecordingStopped', () => {
        const recordingPath = `/recording`
        try {
            oscOut.send(recordingPath, 0)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send stopped state of recording:`, e)
        }
    })

    obs.on('RecordingPaused', () => {
        const recordingPausePath = `/recording/pause`
        try {
            oscOut.send(recordingPausePath, 1)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send paused state of recording:`, e)
        }
    })

    obs.on('RecordingResumed', () => {
        const recordingPath = `/recording/pause`
        try {
            oscOut.send(recordingPath, 0)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send resumed state of recording:`, e)
        }
    })

    obs.on('StudioModeSwitched', (response) => {
        const studioPath = `/studio`
        try {
            oscOut.send(studioPath, response['new-state'] ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send studio mode state:`, e)
        }
    })

    obs.on('PreviewSceneChanged', (response) => {
        const previewPath = `/studio/preview`
        try {
            oscOut.send(previewPath, response['scene-name'])
        } catch (e) {
            if (DEBUG) console.error(`xxx -- Failed to send current preview scene:`, e)
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

    if (path[0] === 'test') {
        if (DEBUG) console.info('processOSCInMessage -- Test function triggered')
        testFunction(path.slice(1), message.slice(1))
        return
    }

    if (path[0] === 'scene') {
        processScene(path.slice(1), message.slice(1))
    } else if (path[0] === 'activeScene') {
        if (message[1]) {
            setCurrentScene(message[1])
        } else {
            getCurrentScene()
        }
    } else if (path[0] === 'source') {
        processSource(path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneItem') {
        processSceneItem(path.slice(1), message.slice(1))
    } else if (path[0] === 'audio') {
        processSourceAudio(path.slice(1), message.slice(1))
    } else if (path[0] === 'media') {

    } else if (path[0] === 'profile') {

    } else if (path[0] === 'recording') {
        processRecording(path.slice(1), message.slice(1))
    } else if (path[0] === 'sceneCollection') {

    } else if (path[0] === 'stream') {

    } else if (path[0] === 'studio') {
        processStudioMode(path.slice(1), message.slice(1))
    } else if (path[0] === 'transition') {

    } else if (path[0] === 'virtualCam') {
        processVirtualCam(path.slice(1), message.slice(1))
    } else if (path[0] === 'output') {
        processOutput(path.slice(1), message.slice(1))
    } else if (path[0] === 'misc') {

    } else if (path[0] === 'sceneAudio') {

    } else if (path[0] === 'sceneSource') {

    } else if (path[0] === 'misc') {

    } else {
        if (DEBUG) console.warn('Unknown message path:', path.join('/'))
    }
}

async function processScene(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getCurrentScene()
        } else {
            setCurrentScene(args[0])
        }
        return
    }

    setCurrentScene(path[0])
}

async function getCurrentScene() {
    const sceneAudioPath = `/sceneAudio`
    try {
        const response = await obs.send('GetCurrentScene')
        try {
            oscOut.send('/activeScene', response.name)
        } catch (e) {
            if (DEBUG) console.error('getCurrentScene -- Failed to sent current scene:', e)
        }

        let globalAudioSource = await getGlobalAudioSourceList()
        let sceneAudioSource = []

        response.sources.forEach(source => {
            // Note: Use source.type instead of source.typeId here, probably a typo in OSBWebSocket (or .js)
            if (audioSourceList.has(source.type) && !globalAudioSource.includes(source.name)) {
                sceneAudioSource.push(source.name)
            }
        })

        sceneAudioSource.sort()
        // if (DEBUG) console.info('Scene audio list:', sceneAudioSource)
        sceneAudioSource = [...globalAudioSource, ...sceneAudioSource]
        try {
            oscOut.send(sceneAudioPath, response.name, sceneAudioSource)
        } catch (e) {
            if (DEBUG) console.error('getCurrentScene -- Failed to sent current scene audio sources:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getCurrentScene -- Failed to get current scene:', e)
    }
}

async function setCurrentScene(scene) {
    if (typeof (scene) === 'number') {
        const sceneList = await getSceneList(false)
        if (!sceneList) return
        if (sceneList[scene] === undefined) {
            if (DEBUG) console.error('SetCurrentScene - Invalid scene index:', scene)
            return
        }

        scene = sceneList[scene]['name']
    }

    try {
        await obs.send('SetCurrentScene', { 'scene-name': scene })
    } catch (e) {
        if (DEBUG) console.error(`SetCurrentScene - Failed to set scene ${scene}:`, e)
    }
}

async function getSceneList(sendOSC = true) {
    const sceneListPath = '/sceneList'
    try {
        const response = await obs.send('GetSceneList')
        if (sendOSC) {
            try {
                oscOut.send(sceneListPath, response.scenes)
            } catch (e) {
                if (DEBUG) console.error('getSceneList -- Failed to send scene list:', e)
            }
        }
        return response.scenes
    } catch (e) {
        if (DEBUG) console.error('getSceneList -- Failed to get scene list:', e)
    }
}

async function processSourceAudio(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getAudioSourceList()
        } else {
            getSourceVolume(args[0])
        }
        return
    }

    if (path[1] === 'volume') {
        if (args === undefined) {
            getSourceVolume(path[0])
        } else {
            setSourceVolume(path[0], args[0])
        }
    } else if (path[1] === 'mute') {
        if (args === undefined) {
            getSourceMuteState()
        } else {
            setSourceMuteState(path[0], args[0])
        }
    }
}

async function getAudioSourceList(sendOSC = true) {
    updateAudioSourceList()

    try {
        const sourceList = await getSourceList(false)
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
        // if (DEBUG) console.info('Audio source list:', audioSource)
        if (sendOSC) {
            try {
                oscOut.send('/audio', audioSource)
            } catch (e) {
                if (DEBUG) console.error('getAudioSourceList -- Failed to send audio source list:', e)
            }
        }
        return audioSource
    } catch (e) {
        if (DEBUG) console.error('getAudioSourceList -- Failed to get source list:', e)
    }
}

async function getGlobalAudioSourceList(sendOSC = true) {
    updateAudioSourceList()

    try {
        const sourceList = await getSourceList(false)
        if (!sourceList) {
            if (DEBUG) console.error('getGlobalAudioSourceList -- No source list')
            return []
        }
        const globalAudioSource = []
        const audioRegex = /^(\w+_){1,}(input|output)_capture$/
        sourceList.forEach(source => {
            if (audioSourceList.has(source.typeId) && source.typeId.match(audioRegex)) {
                globalAudioSource.push(source.name)
            }
        })

        globalAudioSource.sort()
        // if (DEBUG) console.info('Glogal audio source list:', globalAudioSource)
        if (sendOSC) {
            try {
                oscOut.send('/globalAudio', globalAudioSource)
            } catch (e) {
                if (DEBUG) console.error('getGlobalAudioSourceList -- Failed to send global audio source list:', e)
            }
        }
        return globalAudioSource
    } catch (e) {
        if (DEBUG) console.error('getGlobalAudioSourceList -- Failed to get source list:', e)
    }

    return []
}

async function updateAudioSourceList() {
    try {
        const response = await obs.send('GetSourceTypesList')
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

async function getSourceVolume(source) {
    const volumePath = `/audio/${source}/volume`
    const mutePath = `/audio/${source}/mute`
    if (miscConfig.useDbForVolume) {
        try {
            const response = await obs.send('GetVolume', { source: source, useDecibel: true })
            oscOut.send(volumePath, response.volume)
            oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`getSourceVolume - Failed to get volume (dB) of source ${source}:`, e)
        }
    } else {
        try {
            const response = await obs.send('GetVolume', { source: source })
            oscOut.send(volumePath, response.volume)
            oscOut.send(mutePath, response.muted ? 1 : 0)
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

async function getSourceMuteState(source) {
    const mutePath = `/audio/${source}/mute`
    try {
        const response = await obs.send('GetMute', { source: source })
        try {
            oscOut.send(mutePath, response.muted ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error(`getSourceMuteState -- Failed to send mute state of source ${source}:`, e)
        }
    } catch (e) {
        if (DEBUG) console.error(`getSourceMuteState -- Failed to get mute state from scene ${source}:`, e)
    }
}

async function setSourceMuteState(source, state) {
    try {
        await obs.send('SetMute', { source: source, mute: state ? true : false })
    } catch {
        if (DEBUG) console.error(`setSourceMuteState -- Failed to set mute state from scene ${source}:`, e)
    }
}

async function getSourceList(sendOSC = true) {
    const sourceListPath = '/source'
    try {
        const response = await obs.send('GetSourcesList')
        if (sendOSC) {
            const sourceList = response.sources.flatMap((source) => source.name)
            try {
                oscOut.send(sourceListPath, sourceList)
            } catch (e) {
                if (DEBUG) console.error('getSourceList -- Failed to send source list:', e)
            }
        }
        return response.sources
    } catch (e) {
        if (DEBUG) console.error(`getSourceList -- Failed to get source list:`, e)
        return null
    }
}

async function processOutput(path, args) {
    if (path[0] === undefined) {
        getOutputInfo(args[0])
        return
    }

    setOutputState(path, args)
}

async function getOutputList() {
    try {
        const response = await obs.send('ListOutputs')
        const outputList = []
        response.outputs.forEach(output => { outputList.push(output.name) })
        oscOut.send('/outputList', outputList)
    } catch (e) {
        if (DEBUG) console.error('getOutputInfo -- Failed to get output list:', e)
    }
}

async function getOutputInfo(output) {
    if (output === undefined) {
        getOutputList()
        return
    }

    const outputPath = `/output/${output}`
    try {
        const response = await obs.send('GetOutputInfo', { outputName: output })
        oscOut.send(outputPath, response.outputInfo.active ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error('getOutputInfo -- Failed to get output info:', e)
    }
}

async function setOutputState(path, args) {
    if (path[1]) {
        if (path[1] === 'start' && args[0] === 1) startOutput(path[0])
        if (path[1] === 'stop' && args[0] === 1) stopOutput(path[0])
        if (path[1] === 'toggle' && args[0] === 1) toggleOutput(path[0])
        return
    }

    if (args[0] === 1) {
        startOutput(path[0])
    } else {
        stopOutput(path[0])
    }
}

async function startOutput(output) {
    try {
        await obs.send('StartOutput', { outputName: output })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to start output ${output}`, e)
    }
}

async function stopOutput(output) {
    try {
        await obs.send('StopOutput', { outputName: output })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to stop output ${output}`, e)
    }
}

async function toggleOutput(output) {
    try {
        const response = await obs.send('GetOutputInfo', { outputName: output })
        try {
            if (response.outputInfo.active === true) {
                await obs.send('StopOutput', { outputName: output })
            } else {
                await obs.send('StartOutput', { outputName: output })
            }
        } catch (e) {
            if (DEBUG) console.error(`toggleOutput -- Failed to toggle output ${output}`, e)
        }
    } catch (e) {
        if (DEBUG) console.error('toggleOutput -- Failed to get output info:', e)
    }
}

async function processVirtualCam(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getVirtualCamStatus()
            return
        }

        if (args[0] === 1) {
            startVirtualCam()
        } else if (args[0] === 0) {
            stopVirtualCam()
        }
    } else {
        if (path[0] === 'start' && args[0] === 1) {
            startVirtualCam()
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopVirtualCam()
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleVirtualCam()
        }
    }
}

async function getVirtualCamStatus() {
    try {
        const response = await obs.send('GetVirtualCamStatus')
        try {
            oscOut.send('/virtualCam', (response.virtualCamTimecode === undefined) ? 0 : 1)
        } catch (e) {
            if (DEBUG) console.error('getVirtualCamStatus -- Failed to send virtual camera status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getVirtualCamStatus -- Failed to get virtual camera status:', e)
    }
}

async function startVirtualCam() {
    try {
        await obs.send('StartVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('startVirtualCam -- Failed to start virtual camera:', e)
    }
}

async function stopVirtualCam() {
    try {
        await obs.send('StopVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('stopVirtualCam -- Failed to stop virtual camera:', e)
    }
}

async function toggleVirtualCam() {
    try {
        await obs.send('StartStopVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('toggleVirtualCam -- Failed to toggle virtual camera state:', e)
    }
}

async function processRecording(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getRecordingStatus()
            return
        }

        if (args[0] === 1) {
            startRecording()
        } else if (args[0] === 0) {
            stopRecording()
        }
    } else {
        if (path[0] === 'start' && args[0] === 1) {
            startRecording()
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopRecording()
        } else if (path[0] === 'pause') {
            if (args[0] === 1) {
                pauseRecording()
            } else if (args[0] === 0) {
                resumeRecording()
            }
        } else if (path[0] === 'resume' && args[0] === 1) {
            resumeRecording()
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleRecording()
        } else if (path[0] === 'togglePause' && args[0] === 1) {
            togglePauseRecording()
        }
    }
}

async function getRecordingStatus() {
    try {
        const response = await obs.send('GetRecordingStatus')
        try {
            oscOut.send('/recording', response.isRecording ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getRecordingStatus -- Failed to send recording status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getRecordingStatus -- Failed to get recording status:', e)
    }
}

async function startRecording() {
    try {
        await obs.send('StartRecording')
    } catch (e) {
        if (DEBUG) console.error('startRecording -- Failed to start recording:', e)
    }
}

async function stopRecording() {
    try {
        await obs.send('StopRecording')
    } catch (e) {
        if (DEBUG) console.error('stopRecording -- Failed to stop recording:', e)
    }
}

async function toggleRecording() {
    try {
        await obs.send('StartStopRecording')
    } catch (e) {
        if (DEBUG) console.error('toggleRecording -- Failed to toggle recording:', e)
    }
}

async function pauseRecording() {
    try {
        await obs.send('PauseRecording')
    } catch (e) {
        if (DEBUG) console.error('pauseRecording -- Failed to pause recording:', e)
    }
}

async function resumeRecording() {
    try {
        await obs.send('ResumeRecording')
    } catch (e) {
        if (DEBUG) console.error('resumeRecording -- Failed to resume recording:', e)
    }
}

async function togglePauseRecording() {
    try {
        const response = await obs.send('GetRecordingStatus')
        if (response.isRecording === false) {
            if (DEBUG) console.error('togglePauseRecording -- Recording did not start yet')
            return
        }

        try {
            if (response.isRecordingPaused) {
                await obs.send('ResumeRecording')
            } else {
                await obs.send('PauseRecording')
            }
        } catch (e) {
            if (DEBUG) console.error('togglePauseRecording -- Failed to toggle-pause recording:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('togglePauseRecording -- Failed to get recording status:', e)
    }
}

async function processStudioMode(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getStudioModeStatus()
            return
        }

        if (args[0] === 1) {
            enableStudioMode()
        } else if (args[0] === 0) {
            disableStudioMode()
        }
    } else {
        if (path[0] === 'enable' && args[0] === 1) {
            enableStudioMode()
        } else if (path[0] === 'disable' && args[0] === 1) {
            disableStudioMode()
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleStudioMode()
        } else if (path[0] === 'preview') {
            if (args[0] === undefined) {
                getPreviewScene()
            } else {
                setPreviewScene(args[0])
            }
        } else if (path[0] === 'transition') {
            transitionToProgram(args)
        }
    }
}

async function getStudioModeStatus() {
    try {
        const response = await obs.send('GetStudioModeStatus')
        try {
            oscOut.send('/studio', response['studio-mode'] ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getStudioModeStatus -- Failed to send studio mode status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getStudioModeStatus -- Failed to get studio mode status:', e)
    }
}

async function enableStudioMode() {
    try {
        await obs.send('EnableStudioMode')
    } catch (e) {
        if (DEBUG) console.error('enableStudioMode -- Failed to enable studio mode:', e)
    }
}

async function disableStudioMode() {
    try {
        await obs.send('DisableStudioMode')
    } catch (e) {
        if (DEBUG) console.error('disableStudioMode -- Failed to disable studio mode:', e)
    }
}

async function toggleStudioMode() {
    try {
        await obs.send('ToggleStudioMode')
    } catch (e) {
        if (DEBUG) console.error('toggleStudioMode -- Failed to toggle studio mode:', e)
    }
}

async function getPreviewScene() {
    try {
        const response = await obs.send('GetPreviewScene')
        try {
            oscOut.send('/studio/preview', response.name)
        } catch (e) {
            if (DEBUG) console.error('getPreviewScene -- Failed to send preview scene:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getPreviewScene -- Failed to get preview scene:', e)
    }
}

async function setPreviewScene(scene) {
    try {
        await obs.send('SetPreviewScene', { 'scene-name': scene })
    } catch (e) {
        if (DEBUG) console.error('setPreviewScene -- Failed to set preview scene:', e)
    }
}

async function transitionToProgram(args) {
    if (args[0] === undefined) {
        return
    }

    if (typeof (args[0]) === 'number') {
        if (args[0] !== 1) {
            return
        }

        try {
            await obs.send('TransitionToProgram')
        } catch (e) {
            if (DEBUG) console.error('transitionToProgram -- Failed to start transition:', e)
        }
    } else if (typeof (args[0]) === 'string') {
        try {
            await obs.send('TransitionToProgram', { 'with-transition': { name: args[0], ...(typeof (args[1]) === 'number' ? { duration: args[1] } : {}) } })
        } catch (e) {
            if (DEBUG) console.error('transitionToProgram -- Failed to start transition:', e)
        }
    } else {
        if (DEBUG) console.error('transitionToProgram -- Invalid arguments:', args)
    }
}

async function processSource(path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSourceList()
        } else {
            // Note: Might be removed later
            getSourceActive(args[0])
        }
        return
    }

    // TODO: Change path from source/[source]/[setting] to source/[source]/setting/[setting]
    if (path[1] === undefined && DEBUG) {
        getSourceSettings(path[0])
        return
    } else {
        if (args[0] === undefined) {
            getSourceSetting(path[0], path[1])
        } else {
            setSourceSetting(path[0], path[1], args[0])
        }
    }
}

async function getSourceActive(source) {
    const sourceActivePath = `/scene/${source}/active`
    try {
        const response = await obs.send('GetSourceActive', { sourceName: source })
        try {
            oscOut.send(sourceActivePath, response.sourceActive ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getSourceActive -- Failed to send source active status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getSourceActive -- Failed to get source active status:', e)
    }
}

async function getSourceSettings(source, sourceType) {
    try {
        const response = await obs.send('GetSourceSettings', { sourceName: source, ...(sourceType !== undefined ? { sourceType: sourceType } : {}) })
        if (DEBUG) console.info(`${response.sourceName} - ${response.sourceType}:`, response.sourceSettings)
        return response.sourceSettings
    } catch (e) {
        if (DEBUG) console.error('getSourceSettings -- Failed to get source settings:', e)
    }
}

async function getSourceSetting(source, setting) {
    const sourceSettingPath = `/source/${source}/${setting}`
    const sourceSettings = getSourceSettings(source)
    if (!sourceSettings) { return }
    if (sourceSettings[setting] === undefined) {
        if (DEBUG) console.error('getSourceSetting -- No matched setting name:', setting)
        return
    }

    try {
        oscOut.send(sourceSettingPath, sourceSettings[setting])
    } catch (e) {
        if (DEBUG) console.error(`getSourceSetting -- Failed to send source setting ${setting}:`, e)
    }
}

async function setSourceSetting(source, setting, value, sourceType) {
    const sourceSettings = getSourceSettings(source)
    if (!sourceSettings) { return }
    // Note: Due to how OBSWebSocket work, settings might not show up
    //       until it's been changed at least once in OBS
    // if (sourceSettings[setting] === undefined) {
    //     if (DEBUG) console.error('setSourceSetting -- No matched setting name', setting)
    //     return
    // }

    sourceSettings[setting] = value
    try {
        const response = await obs.send('SetSourceSettings', { sourceName: source, sourceSettings: sourceSettings, ...(sourceType !== undefined ? { sourceType: sourceType } : {}) })
    } catch (e) {
        if (DEBUG) console.error('getSourceSettings -- Failed to set source setting:', e)
    }
}

async function processSceneItem(path, args) {
    if (path[0] === undefined) {
        getSceneItemList(args[0])
        return
    }

    // if (path[1] === undefined) {
    //     // Might be removed later
    //     getSceneItemProperties(path)
    //     return
    // }

    // if (args[0] === undefined) {
    //     getSceneItemProperties(path)
    // }

    // path: [scene]/[source|group/source]/[property|show|reset]

    for (let i = 1; i < 4; i++) {
        if (path[i] === undefined) { return }
        if (keywords.sceneItem.includes(path[i])) {
            if (path[i] === 'property') {
                if (path[i + 1] === undefined) {
                    getSceneItemProperties(path.slice(0, i))
                    return
                }

                if (args[0] === undefined) {
                    getSceneItemProperty(path.slice(0, i), path.slice(i + 1))
                } else {
                    setSceneItemProperty(path.slice(0, i), path.slice(i + 1), args)
                }
            } else if (path[i] === 'show') {
                if (args[0] === 1 || args[0] === 0) {
                    setSceneItemRender(path.slice(0, i), args[0])
                }
            } else if (path[i] === 'hide' && args[0] === 1) {
                setSceneItemRender(path.slice(0, i), 0)
            } else if (path[i] === 'reset' && args[0] === 1) {
                resetSceneItem(path.slice(0, i))
            } else {
                if (DEBUG) console.error('processSceneItem -- Invalid command:', path[i])
                return
            }
        }
    }
}

async function getSceneItemList(scene, sendOSC = true) {
    const sceneItemListPath = '/sceneItem'
    try {
        const response = await obs.send('GetSceneItemList', scene !== undefined ? { sceneName: scene } : undefined)
        if (sendOSC) {
            const sceneItemList = response.sceneItems.flatMap(sceneItem => sceneItem.sourceName)
            // Note: OBSWebSocket (v4.x) do not report sources under
            //       group and cannot be obtained from GetSceneItemProperties
            //       because SceneItemTransform have no name/item property
            try {
                // TODO: Add option to add scene name before source name
                oscOut.send(sceneItemListPath, sceneItemList)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemList -- Failed to send scene item list', e)
            }
        }
        return response
    } catch (e) {
        if (DEBUG) console.error('getSceneItemList -- Failed to get scene item list', e)
    }
}

async function getSceneItemProperties(path, sendOSC = true) {
    const sceneItemPropertiesPath = `/sceneItem/${path.join('/')}`
    // if (DEBUG) console.info('getSceneItemProperties -- feedback path:', sceneItemPropertiesPath)

    if (path.length === 0 || path.length > 3) {
        if (DEBUG) console.error('getSceneItemProperties -- Invalid path (too short or too long):', path.join('/'))
        return
    }

    let scene, sceneItem
    if (path.length === 1) {
        sceneItem = path[0]
    } else {
        scene = path[0]
        sceneItem = path.at(-1)
    }

    try {
        const response = await obs.send('GetSceneItemProperties', { item: sceneItem, ...(scene !== undefined ? { 'scene-name': scene } : {}) })
        if (path.length === 3) {
            console.info('Parent name:', response.parentGroupName)
            if (response.parentGroupName !== path[1]) {
                if (DEBUG) console.error('getSceneItemProperties -- Invalid path (wrong parent group):', path.join('/'))
                return
            }
        }

        if (sendOSC) {
            try {
                const propertyList = parsePropertyList(response)
                oscOut.send(sceneItemPropertiesPath, propertyList)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemProperties -- Failed to send scene item properties:', e)
            }
        }
        return response
    } catch (e) {
        if (DEBUG) console.error('getSceneItemProperties -- Failed to get scene item properties:', e)
    }
}

function parsePropertyList(properties) {
    const propertyList = []

    for (const key in properties) {
        if (typeof (properties[key]) === 'object') {
            for (const subKey in properties[key]) {
                propertyList.push(`${key}/${subKey}`)
            }
        } else {
            propertyList.push(key)
        }
    }

    return propertyList
}

async function getSceneItemProperty(path, propertyPath, sendOSC = true) {
    if (propertyPath === undefined || propertyPath.length === 0) { return }
    if (propertyPath.length > 3) {
        if (DEBUG) console.error('getSceneItemProperty -- Invalid property:', propertyPath.join('/'))
        return
    }
    let SceneItemPropertyPath = `/sceneItem/${path.join('/')}/property/${propertyPath.join('/')}`
    const properties = await getSceneItemProperties(path, false)
    if (properties === undefined) { return }

    let property = properties
    for (const p of propertyPath) {
        property = property[p]
        if (property === undefined) {
            if (DEBUG) console.error('getSceneItemProperty -- Unknown property:', propertyPath.join('/'))
            return
        }
    }

    if (sendOSC) {
        // TODO: Add option to send complete path
        if (false) {
            const sceneItemList = await getSceneItemList(undefined, false)
            if (sceneItemList === undefined) {
                if (DEBUG) console.error('getSceneItemProperty -- Failed to get scene name from getSceneItemList')
                return
            }
            SceneItemPropertyPath = `/sceneItem/${sceneItemList.sceneName}${properties.parentGroupName !== undefined ? '/' + properties.parentGroupName : ''}/${properties.name}/property/${propertyPath.join('/')}`
        }

        if (typeof (property) !== 'object') {
            try {
                oscOut.send(SceneItemPropertyPath, property)
            } catch (e) {
                if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}:`, e)
            }
        } else {
            for (const key in property) {
                if (typeof (property[key]) === 'object') {
                    if (DEBUG) console.error(`getSceneItemProperty -- Property ${propertyPath.join('/')} is not a single-level object`)
                    return
                }
            }

            // TODO: Add option to toggle the path to send single-level object's values
            if (true) {
                for (const key in property) {
                    try {
                        oscOut.send(SceneItemPropertyPath.concat('/', key), property[key])
                    } catch (e) {
                        if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}/${key}:`, e)
                    }
                }
            } else {
                try {
                    oscOut.send(SceneItemPropertyPath, Object.values(property))
                } catch (e) {
                    if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}:`, e)
                }
            }
        }
    }

    return property
}

async function setSceneItemProperty(path, propertyPath, args) {
    if (path.length === 0 || path.length > 3) {
        if (DEBUG) console.error('setSceneItemProperty -- Invalid path (too short or too long):', path.join('/'))
        return
    }
    if (propertyPath.length === 0 || propertyPath.length > 2) {
        if (DEBUG) console.error('setSceneItemProperty -- Invalid property path (too short or too long):', propertyPath.join('/'))
        return
    }

    const properties = await getSceneItemProperties(path, false)
    if (properties === undefined) { return }

    if (path.length !== 1) {
        properties['scene-name'] = path[0]
    }
    properties.item = properties.name


    let property = properties
    let propertyParent
    for (const p of propertyPath) {
        propertyParent = property
        property = property[p]
        if (property === undefined) {
            if (DEBUG) console.error('setSceneItemProperty -- Unknown property:', propertyPath.join('/'))
            return
        }
    }

    if (typeof (property) !== 'object') {
        propertyParent[propertyPath.at(-1)] = args[0]
    } else if (true) {
        if (args.length !== Object.keys(property).length) {
            if (DEBUG) console.error(`setSceneItemProperty -- Number of arguments (${args.length}) not match the number of child properties (${Object.keys(property).length})`)
            return
        }
        let i = 0
        for (const key in property) {
            property[key] = args[i]
            i++
        }
    }

    try {
        await obs.send('SetSceneItemProperties', properties)
    } catch (e) {
        if (DEBUG) console.error(`setSceneItemProperty -- Failed to set scene item property ${propertyPath.join('/')}:`, e)
    }
}

async function setSceneItemRender(path, render) {
    const properties = await getSceneItemProperties(path, false)
    if (properties === undefined) { return }

    try {
        obs.send('SetSceneItemRender', { source: path.at(-1), render: render ? true : false, ...((path.length > 1) ? { 'scene-name': path[0] } : {}) })
    } catch (e) {
        if (DEBUG) console.error('setSceneItemRender -- Failed to set scene item render state:', e)
    }
}

async function resetSceneItem(path) {
    const properties = await getSceneItemProperties(path, false)
    if (properties === undefined) { return }

    try {
        await obs.send('ResetSceneItem', { item: path.at(-1), ...((path.length > 1) ? { 'scene-name': path[0] } : {}) })
    } catch (e) {
        if (DEBUG) console.error('resetSceneItem -- Failed to reset scene item:', e)
    }
}

async function testFunction(path, args) {
    if (DEBUG) console.info(path, args)
}
