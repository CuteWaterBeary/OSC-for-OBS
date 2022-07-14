module.exports = { processVirtualCam, sendVirtualCamStateFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processVirtualCam(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getVirtualCamStatus(networks)
            return
        }

        if (args[0] === 1) {
            startVirtualCam(networks)
        } else if (args[0] === 0) {
            stopVirtualCam(networks)
        }
    } else {
        if (path[0] === 'start' && args[0] === 1) {
            startVirtualCam(networks)
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopVirtualCam(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleVirtualCam(networks)
        }
    }
}

async function getVirtualCamStatus(networks) {
    try {
        const response = await networks.obs.send('GetVirtualCamStatus')
        try {
            networks.oscOut.send('/virtualCam', (response.virtualCamTimecode === undefined) ? 0 : 1)
        } catch (e) {
            if (DEBUG) console.error('getVirtualCamStatus -- Failed to send virtual camera status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getVirtualCamStatus -- Failed to get virtual camera status:', e)
    }
}

async function startVirtualCam(networks) {
    try {
        await networks.obs.send('StartVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('startVirtualCam -- Failed to start virtual camera:', e)
    }
}

async function stopVirtualCam(networks) {
    try {
        await networks.obs.send('StopVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('stopVirtualCam -- Failed to stop virtual camera:', e)
    }
}

async function toggleVirtualCam(networks) {
    try {
        await networks.obs.send('StartStopVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('toggleVirtualCam -- Failed to toggle virtual camera state:', e)
    }
}

function sendVirtualCamStateFeedback(networks, state) {
    const virtualCamPath = `/virtualCam`
    try {
        networks.oscOut.send(virtualCamPath, state)
    } catch (e) {
        if (DEBUG) console.error(`sendVirtualCamStateFeedback -- Failed to send virtual camera state feedback:`, e)
    }
}
