module.exports = { processRecording, sendRecordingStateFeedback, sendRecordingPauseStateFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processRecording(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getRecordingStatus(networks)
            return
        }

        if (args[0] === 1) {
            startRecording(networks)
        } else if (args[0] === 0) {
            stopRecording(networks)
        }
    } else {
        if (path[0] === 'start' && args[0] === 1) {
            startRecording(networks)
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopRecording(networks)
        } else if (path[0] === 'pause') {
            if (args[0] === 1) {
                pauseRecording(networks)
            } else if (args[0] === 0) {
                resumeRecording(networks)
            }
        } else if (path[0] === 'resume' && args[0] === 1) {
            resumeRecording(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleRecording(networks)
        } else if (path[0] === 'togglePause' && args[0] === 1) {
            togglePauseRecording(networks)
        }
    }
}

async function getRecordingStatus(networks) {
    try {
        const response = await networks.obs.send('GetRecordingStatus')
        try {
            networks.oscOut.send('/recording', response.isRecording ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getRecordingStatus -- Failed to send recording status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getRecordingStatus -- Failed to get recording status:', e)
    }
}

async function startRecording(networks) {
    try {
        await networks.obs.send('StartRecording')
    } catch (e) {
        if (DEBUG) console.error('startRecording -- Failed to start recording:', e)
    }
}

async function stopRecording(networks) {
    try {
        await networks.obs.send('StopRecording')
    } catch (e) {
        if (DEBUG) console.error('stopRecording -- Failed to stop recording:', e)
    }
}

async function toggleRecording(networks) {
    try {
        await networks.obs.send('StartStopRecording')
    } catch (e) {
        if (DEBUG) console.error('toggleRecording -- Failed to toggle recording:', e)
    }
}

async function pauseRecording(networks) {
    try {
        await networks.obs.send('PauseRecording')
    } catch (e) {
        if (DEBUG) console.error('pauseRecording -- Failed to pause recording:', e)
    }
}

async function resumeRecording(networks) {
    try {
        await networks.obs.send('ResumeRecording')
    } catch (e) {
        if (DEBUG) console.error('resumeRecording -- Failed to resume recording:', e)
    }
}

async function togglePauseRecording(networks) {
    try {
        const response = await networks.obs.send('GetRecordingStatus')
        if (response.isRecording === false) {
            if (DEBUG) console.error('togglePauseRecording -- Recording did not start yet')
            return
        }

        try {
            if (response.isRecordingPaused) {
                await networks.obs.send('ResumeRecording')
            } else {
                await networks.obs.send('PauseRecording')
            }
        } catch (e) {
            if (DEBUG) console.error('togglePauseRecording -- Failed to toggle-pause recording:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('togglePauseRecording -- Failed to get recording status:', e)
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
    const recordingPath = `/recording/pause`
    try {
        networks.oscOut.send(recordingPath, state)
    } catch (e) {
        if (DEBUG) console.error(`sendRecordingPauseStateFeedback -- Failed to send recording pause state feedback:`, e)
    }
}
