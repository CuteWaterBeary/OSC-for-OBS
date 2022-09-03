const DEBUG = process.argv.includes('--enable-log')
const TEST = process.argv.includes('--unit-test')

if (TEST) {
    module.exports = { processVirtualCam, getVirtualCamStatus, startVirtualCam, stopVirtualCam, toggleVirtualCam, sendVirtualCamStateFeedback }
} else {
    module.exports = { processVirtualCam, sendVirtualCamStateFeedback }
}

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
        if (path[0] === 'start') {
            if (args[0] === 1) {
                startVirtualCam(networks)
            } else if (args[0] === 0) {
                stopVirtualCam(networks)
            }
        } else if (path[0] === 'stop' && args[0] === 1) {
            stopVirtualCam(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleVirtualCam(networks)
        }
    }
}

async function getVirtualCamStatus(networks, sendOSC = true) {
    const virtualCamPath = `/virtualCam`
    try {
        const { outputActive } = await networks.obs.call('GetVirtualCamStatus')
        if (sendOSC) {
            try {
                networks.oscOut.send(virtualCamPath, outputActive ? 0 : 1)
            } catch (e) {
                if (DEBUG) console.error('getVirtualCamStatus -- Failed to send virtual camera status:', e)
            }
        }
        return outputActive
    } catch (e) {
        if (DEBUG) console.error('getVirtualCamStatus -- Failed to get virtual camera status:', e)
    }
}

async function startVirtualCam(networks) {
    try {
        await networks.obs.call('StartVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('startVirtualCam -- Failed to start virtual camera:', e)
    }
}

async function stopVirtualCam(networks) {
    try {
        await networks.obs.call('StopVirtualCam')
    } catch (e) {
        if (DEBUG) console.error('stopVirtualCam -- Failed to stop virtual camera:', e)
    }
}

async function toggleVirtualCam(networks) {
    try {
        await networks.obs.call('ToggleVirtualCam')
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
