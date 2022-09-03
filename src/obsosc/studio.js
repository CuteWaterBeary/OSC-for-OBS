const { setCurrentSceneTransition, setCurrentSceneTransitionDuration, setTBarPosition } = require('./transition')

const DEBUG = process.argv.includes('--enable-log')
const TEST = process.argv.includes('--unit-test')

if (TEST) {
    module.exports = { processStudioMode, getStudioModeEnabled, setStudioModeEnabled, toggleStudioMode, getCurrentPreviewScene, setCurrentPreviewScene, transitionToProgram, triggerStudioModeTransition, sendStudioModeStateFeedback, sendStudioPreviewSceneFeedback }
} else {
    module.exports = { processStudioMode, sendStudioModeStateFeedback, sendStudioPreviewSceneFeedback }
}

async function processStudioMode(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getStudioModeEnabled(networks)
            return
        }

        setStudioModeEnabled(networks, args[0])
    } else {
        if (path[0] === 'enable') {
            setStudioModeEnabled(networks, args[0])
        } else if (path[0] === 'disable' && args[0] === 1) {
            setStudioModeEnabled(networks, 0)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleStudioMode(networks)
        } else if (path[0] === 'preview') {
            if (args[0] === undefined) {
                getCurrentPreviewScene(networks)
            } else {
                setCurrentPreviewScene(networks, args[0])
            }
        } else if (path[0] === 'transition') {
            transitionToProgram(networks, args)
        } else if (path[0] === 'cursor' && args[0] !== undefined) {
            setTBarPosition(networks, args[0])
        }
    }
}

async function getStudioModeEnabled(networks, sendOSC = true) {
    const studioEnabledPath = '/studio'
    try {
        const { studioModeEnabled } = await networks.obs.call('GetStudioModeEnabled')
        if (sendOSC) {
            try {
                networks.oscOut.send(studioEnabledPath, studioModeEnabled ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error('getStudioModeEnabled -- Failed to send studio mode status:', e)
            }
        }

        return studioModeEnabled
    } catch (e) {
        if (DEBUG) console.error('getStudioModeEnabled -- Failed to get studio mode status:', e)
    }
}

async function setStudioModeEnabled(networks, state) {
    try {
        await networks.obs.call('SetStudioModeEnabled', { studioModeEnabled: state ? true : false })
    } catch (e) {
        if (DEBUG) console.error('enableStudioMode -- Failed to enable studio mode:', e)
    }
}

async function toggleStudioMode(networks) {
    const studioModeEnabled = await getStudioModeEnabled(networks, false)
    setStudioModeEnabled(networks, !studioModeEnabled)
}

async function getCurrentPreviewScene(networks, sendOSC = true) {
    const studioPreviewScenePath = '/studio/preview'
    try {
        const { currentPreviewSceneName } = await networks.obs.call('GetCurrentPreviewScene')

        if (sendOSC) {
            try {
                networks.oscOut.send(studioPreviewScenePath, currentPreviewSceneName)
            } catch (e) {
                if (DEBUG) console.error('getCurrentPreviewScene -- Failed to send preview scene:', e)
            }
        }

        return currentPreviewSceneName
    } catch (e) {
        if (DEBUG) console.error('getCurrentPreviewScene -- Failed to get preview scene:', e)
    }
}

async function setCurrentPreviewScene(networks, sceneName) {
    try {
        await networks.obs.call('SetCurrentPreviewScene', { sceneName })
    } catch (e) {
        if (DEBUG) console.error('setCurrentPreviewScene -- Failed to set preview scene:', e)
    }
}

async function transitionToProgram(networks, args) {
    if (args[0] === undefined) {
        return
    }

    if (typeof (args[0]) === 'number') {
        if (args[0] !== 1) return
        triggerStudioModeTransition(networks)
    } else if (typeof (args[0]) === 'string') {
        await setCurrentSceneTransition(networks, args[0])
        if (typeof (args[1]) === 'number') {
            await setCurrentSceneTransitionDuration(networks, args[1])
        }
        triggerStudioModeTransition(networks)
    } else {
        if (DEBUG) console.error('transitionToProgram -- Invalid arguments:', args)
    }
}

async function triggerStudioModeTransition(networks) {
    try {
        await networks.obs.call('TriggerStudioModeTransition')
    } catch (e) {
        if (DEBUG) console.error('triggerStudioModeTransition -- Failed to trigger studio mode transition:', e)
    }
}

function sendStudioModeStateFeedback(networks, state) {
    const studioPath = `/studio`
    try {
        networks.oscOut.send(studioPath, state ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error(`sendStudioModeStateFeedback -- Failed to send studio mode state feedback:`, e)
    }
}

function sendStudioPreviewSceneFeedback(networks, sceneName) {
    const previewPath = `/studio/preview`
    try {
        networks.oscOut.send(previewPath, sceneName)
    } catch (e) {
        if (DEBUG) console.error(`sendStudioPreviewSceneFeedback -- Failed to send current preview scene feedback:`, e)
    }
}
