module.exports = { processStudioMode, sendStudioModeStateFeedback, sendStudioPreviewSceneFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processStudioMode(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getStudioModeStatus(networks)
            return
        }

        if (args[0] === 1) {
            enableStudioMode(networks)
        } else if (args[0] === 0) {
            disableStudioMode(networks)
        }
    } else {
        if (path[0] === 'enable' && args[0] === 1) {
            enableStudioMode(networks)
        } else if (path[0] === 'disable' && args[0] === 1) {
            disableStudioMode(networks)
        } else if (path[0] === 'toggle' && args[0] === 1) {
            toggleStudioMode(networks)
        } else if (path[0] === 'preview') {
            if (args[0] === undefined) {
                getPreviewScene(networks)
            } else {
                setPreviewScene(networks, args[0])
            }
        } else if (path[0] === 'transition') {
            transitionToProgram(networks, args)
        }
    }
}

async function getStudioModeStatus(networks) {
    try {
        const response = await networks.obs.send('GetStudioModeStatus')
        try {
            networks.oscOut.send('/studio', response['studio-mode'] ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getStudioModeStatus -- Failed to send studio mode status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getStudioModeStatus -- Failed to get studio mode status:', e)
    }
}

async function enableStudioMode(networks) {
    try {
        await networks.obs.send('EnableStudioMode')
    } catch (e) {
        if (DEBUG) console.error('enableStudioMode -- Failed to enable studio mode:', e)
    }
}

async function disableStudioMode(networks) {
    try {
        await networks.obs.send('DisableStudioMode')
    } catch (e) {
        if (DEBUG) console.error('disableStudioMode -- Failed to disable studio mode:', e)
    }
}

async function toggleStudioMode(networks) {
    try {
        await networks.obs.send('ToggleStudioMode')
    } catch (e) {
        if (DEBUG) console.error('toggleStudioMode -- Failed to toggle studio mode:', e)
    }
}

async function getPreviewScene(networks) {
    try {
        const response = await networks.obs.send('GetPreviewScene')
        try {
            networks.oscOut.send('/studio/preview', response.name)
        } catch (e) {
            if (DEBUG) console.error('getPreviewScene -- Failed to send preview scene:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getPreviewScene -- Failed to get preview scene:', e)
    }
}

async function setPreviewScene(networks, scene) {
    try {
        await networks.obs.send('SetPreviewScene', { 'scene-name': scene })
    } catch (e) {
        if (DEBUG) console.error('setPreviewScene -- Failed to set preview scene:', e)
    }
}

async function transitionToProgram(networks, args) {
    if (args[0] === undefined) {
        return
    }

    if (typeof (args[0]) === 'number') {
        if (args[0] !== 1) {
            return
        }

        try {
            await networks.obs.send('TransitionToProgram')
        } catch (e) {
            if (DEBUG) console.error('transitionToProgram -- Failed to start transition:', e)
        }
    } else if (typeof (args[0]) === 'string') {
        try {
            await networks.obs.send('TransitionToProgram', { 'with-transition': { name: args[0], ...(typeof (args[1]) === 'number' ? { duration: args[1] } : {}) } })
        } catch (e) {
            if (DEBUG) console.error('transitionToProgram -- Failed to start transition:', e)
        }
    } else {
        if (DEBUG) console.error('transitionToProgram -- Invalid arguments:', args)
    }
}

function sendStudioModeStateFeedback(networks, response) {
    const studioPath = `/studio`
    try {
        networks.oscOut.send(studioPath, response['new-state'] ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error(`sendStudioModeStateFeedback -- Failed to send studio mode state feedback:`, e)
    }
}

function sendStudioPreviewSceneFeedback(networks, response) {
    const previewPath = `/studio/preview`
        try {
            networks.oscOut.send(previewPath, response['scene-name'])
        } catch (e) {
            if (DEBUG) console.error(`sendStudioPreviewSceneFeedback -- Failed to send current preview scene feedback:`, e)
        }
}
