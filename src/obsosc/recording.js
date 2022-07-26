module.exports = { processRecording, sendRecordingStateFeedback, sendRecordingPauseStateFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processRecording(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getRecordStatus(networks)
            return
        }

        if (args[0] === 1) {
            startRecord(networks)
        } else if (args[0] === 0) {
            stopRecord(networks)
        }
    } else {
        if (path[0] === 'start') {
            if (args[0] === 1) {
                startRecord(networks)
            } else if (args[0] === 0) {
                stopRecord(networks)
            }
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopRecord(networks)
        } else if (path[0] === 'pause') {
            if (args[0] === 1) {
                pauseRecord(networks)
            } else if (args[0] === 0) {
                resumeRecord(networks)
            }
        } else if (path[0] === 'resume' && args[0] === 1) {
            resumeRecord(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleRecord(networks)
        } else if (path[0] === 'togglePause' && args[0] === 1) {
            toggleRecordPause(networks)
        }
    }
}

async function getRecordStatus(networks) {
    const recordPath = '/recording'
    const recordPausePath = `/recording/pause`
    try {
        const { outputActive, ouputPaused } = await networks.obs.call('GetRecordStatus')
        try {
            networks.oscOut.send(recordPath, outputActive ? 1 : 0)
            networks.oscOut.send(recordPausePath, ouputPaused ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getRecordStatus -- Failed to send recording status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getRecordStatus -- Failed to get recording status:', e)
    }
}

async function startRecord(networks) {
    try {
        await networks.obs.call('StartRecord')
    } catch (e) {
        if (DEBUG) console.error('startRecord -- Failed to start recording:', e)
    }
}

async function stopRecord(networks) {
    try {
        await networks.obs.call('StopRecord')
    } catch (e) {
        if (DEBUG) console.error('stopRecord -- Failed to stop recording:', e)
    }
}

async function toggleRecord(networks) {
    try {
        await networks.obs.call('ToggleRecord')
    } catch (e) {
        if (DEBUG) console.error('toggleRecord -- Failed to toggle recording:', e)
    }
}

async function pauseRecord(networks) {
    try {
        await networks.obs.call('PauseRecord')
    } catch (e) {
        if (DEBUG) console.error('pauseRecord -- Failed to pause recording:', e)
    }
}

async function resumeRecord(networks) {
    try {
        await networks.obs.call('ResumeRecord')
    } catch (e) {
        if (DEBUG) console.error('resumeRecord -- Failed to resume recording:', e)
    }
}

async function toggleRecordPause(networks) {
    try {
        await networks.obs.call('ToggleRecordPause')
    } catch (e) {
        if (DEBUG) console.error('toggleRecordPause -- Failed to toggle-pause recording:', e)
    }
}

function sendRecordingStateFeedback(networks, state) {
    const recordingPath = `/recording`
    try {
        networks.oscOut.send(recordingPath, state)
    } catch (e) {
        if (DEBUG) console.error(`sendRecordingStateFeedback -- Failed to send recording state feedback:`, e)
    }
}

function sendRecordingPauseStateFeedback(networks, state) {
    const recordPausePath = `/recording/pause`
    try {
        networks.oscOut.send(recordPausePath, state)
    } catch (e) {
        if (DEBUG) console.error(`sendRecordingPauseStateFeedback -- Failed to send recording pause state feedback:`, e)
    }
}
