const { sendSceneAudioFeedback } = require('./audio')

const DEBUG = process.argv.includes('--enable-log')

module.exports = { processScene, getCurrentScene, setCurrentScene, sendActiveSceneFeedback, sendCustomActiveSceneFeedback, sendSceneCompletedFeedback }

async function processScene(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getCurrentScene(networks)
        } else {
            setCurrentScene(networks, args[0])
        }
        return
    }

    setCurrentScene(networks, path[0])
}

async function getCurrentScene(networks) {
    try {
        const response = await networks.obs.send('GetCurrentScene')
        try {
            networks.oscOut.send('/activeScene', response.name)
        } catch (e) {
            if (DEBUG) console.error('getCurrentScene -- Failed to sent current scene:', e)
        }

        sendSceneAudioFeedback(networks, response)
    } catch (e) {
        if (DEBUG) console.error('getCurrentScene -- Failed to get current scene:', e)
    }
}

async function setCurrentScene(networks, scene) {
    if (typeof (scene) === 'number') {
        const sceneList = await getSceneList(networks, false)
        if (!sceneList) return
        if (sceneList[scene] === undefined) {
            if (DEBUG) console.error('SetCurrentScene - Invalid scene index:', scene)
            return
        }

        scene = sceneList[scene]['name']
    }

    try {
        await networks.obs.send('SetCurrentScene', { 'scene-name': scene })
    } catch (e) {
        if (DEBUG) console.error(`SetCurrentScene - Failed to set scene ${scene}:`, e)
    }
}

async function getSceneList(networks, sendOSC = true) {
    const sceneListPath = '/sceneList'
    try {
        const response = await networks.obs.send('GetSceneList')
        if (sendOSC) {
            try {
                networks.oscOut.send(sceneListPath, response.scenes)
            } catch (e) {
                if (DEBUG) console.error('getSceneList -- Failed to send scene list:', e)
            }
        }
        return response.scenes
    } catch (e) {
        if (DEBUG) console.error('getSceneList -- Failed to get scene list:', e)
    }
}

async function sendActiveSceneFeedback(networks, response) {
    const activeScenePath = '/activeScene'
    try {
        networks.oscOut.send(activeScenePath, response.toScene)
    } catch {
        if (DEBUG) console.error('sendActiveSceneFeedback -- Failed to send active scene feedback:', e)
    }
}

async function sendCustomActiveSceneFeedback(networks, response) {
    const customPath = `/${networks.miscConfig.useCustomPath.prefix}/${response.toScene}${(networks.miscConfig.useCustomPath.suffix !== '') ? '/' + networks.miscConfig.useCustomPath.suffix : ''}`
    try {
        networks.oscOut.send(customPath, 1)
    } catch {
        if (DEBUG) console.error('sendCustomActiveSceneFeedback -- Failed to send custom active scene feedback:', e)
    }
}

async function sendSceneCompletedFeedback(networks, response) {
    const sceneCompletedPath = '/activeSceneCompleted'
    try {
        networks.oscOut.send(sceneCompletedPath, response.sceneName)
    } catch {
        if (DEBUG) console.error('sendSceneCompletedFeedback -- Failed to send scene completion feedback:', e)
    }
}
