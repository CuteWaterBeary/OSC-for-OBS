if (process.argv.includes('--unit-test')) {
    module.exports = { processStreaming, getStreamStatus, startStream, stopStream, toggleStream, sendStreamingStateFeedback }
} else {
    module.exports = { processStreaming, sendStreamingStateFeedback }
}

const DEBUG = process.argv.includes('--enable-log')

async function processStreaming(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getStreamStatus(networks)
            return
        }

        if (args[0] === 1) {
            startStream(networks)
        } else if (args[0] === 0) {
            stopStream(networks)
        }
    } else {
        if (path[0] === 'start') {
            if (args[0] === 1) {
                startStream(networks)
            } else if (args[0] === 0) {
                stopStream(networks)
            }
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopStream(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleStream(networks)
        }
    }
}

async function getStreamStatus(networks) {
    const streamPath = '/streaming'
    try {
        const { outputActive } = await networks.obs.call('GetStreamStatus')
        try {
            networks.oscOut.send(streamPath, outputActive ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getStreamStatus -- Failed to send streaming status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getStreamStatus -- Failed to get streaming status:', e)
    }
}

async function startStream(networks) {
    try {
        await networks.obs.call('StartStream')
    } catch (e) {
        if (DEBUG) console.error('startStream -- Failed to start streaming:', e)
    }
}

async function stopStream(networks) {
    try {
        await networks.obs.call('StopStream')
    } catch (e) {
        if (DEBUG) console.error('stopStream -- Failed to stop streaming:', e)
    }
}

async function toggleStream(networks) {
    try {
        await networks.obs.call('ToggleStream')
    } catch (e) {
        if (DEBUG) console.error('toggleStream -- Failed to toggle streaming:', e)
    }
}

function sendStreamingStateFeedback(networks, state) {
    const streamingPath = `/streaming`
    try {
        networks.oscOut.send(streamingPath, state)
    } catch (e) {
        if (DEBUG) console.error(`sendStreamingStateFeedback -- Failed to send streaming state feedback:`, e)
    }
}
