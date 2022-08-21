module.exports = { processScene, processActiveScene, getCurrentProgramScene, getSceneList, sendActiveSceneFeedback, sendSceneCompletedFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processScene(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSceneList(networks)
        } else {
            setCurrentProgramScene(networks, args[0])
        }
        return
    }

    if (path[0] === 'current') {
        // TODO: Add custom path support or deprecate either this or /activeScene
        let sceneName = await getCurrentProgramScene(networks, false)
        try {
            networks.oscOut.send('/scene/current', sceneName)
        } catch (e) {
            if (DEBUG) console.error('processScene -- Failed to sent current scene:', e)
        }
    } else {
        setCurrentProgramScene(networks, path[0])
    }
}

async function processActiveScene(networks, path, args) {
    if (path.length !== 0) return

    if (args[0] !== undefined) {
        setCurrentProgramScene(networks, args[0])
    } else {
        getCurrentProgramScene(networks)
    }
}

async function getSceneList(networks, sendOSC = true) {
    const sceneListPath = '/scene'
    try {
        const { scenes } = await networks.obs.call('GetSceneList')
        if (sendOSC) {
            try {
                networks.oscOut.send(sceneListPath, scenes.flatMap(scene => scene.sceneName))
            } catch (e) {
                if (DEBUG) console.error('getSceneList -- Failed to send scene list:', e)
            }
        }
        return scenes
    } catch (e) {
        if (DEBUG) console.error('getSceneList -- Failed to get scene list:', e)
    }
}

async function getCurrentProgramScene(networks, sendOSC = true) {
    const currentScenePath = '/activeScene'
    try {
        const { currentProgramSceneName } = await networks.obs.call('GetCurrentProgramScene')
        if (sendOSC) {
            try {
                networks.oscOut.send(currentScenePath, currentProgramSceneName)
            } catch (e) {
                if (DEBUG) console.error('getCurrentProgramScene -- Failed to sent current scene:', e)
            }
        }
        return currentProgramSceneName
    } catch (e) {
        if (DEBUG) console.error('getCurrentProgramScene -- Failed to get current scene:', e)
    }
}

async function setCurrentProgramScene(networks, sceneName) {
    if (typeof (sceneName) === 'number') {
        const sceneList = await getSceneList(networks, false)
        if (!sceneList) return
        if (sceneList[sceneName] === undefined) {
            if (DEBUG) console.error('setCurrentProgramScene - Invalid scene index:', sceneName)
            return
        }

        // NOTE: It seems that OBSWebSocket (v5.0.0 at this point) list scenes from bottom to top
        sceneName = sceneList.at(-sceneName - 1).sceneName
    }

    try {
        await networks.obs.call('SetCurrentProgramScene', { sceneName: sceneName })
    } catch (e) {
        if (DEBUG) console.error(`setCurrentProgramScene - Failed to set scene ${sceneName}:`, e)
    }
}

async function sendActiveSceneFeedback(networks) {
    getCurrentProgramScene(networks)
}

async function sendSceneCompletedFeedback(networks, sceneName) {
    const sceneCompletedPath = '/activeSceneCompleted'
    try {
        networks.oscOut.send(sceneCompletedPath, sceneName)
    } catch {
        if (DEBUG) console.error('sendSceneCompletedFeedback -- Failed to send scene completion feedback:', e)
    }
}
