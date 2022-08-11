module.exports = { processSceneCollection, sendCurrentSceneCollectionFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processSceneCollection(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSceneCollectionList(networks)
        } else {
            setCurrentSceneCollection(networks, args[0])
        }
    }

    if (path[0] === 'current') {
        getCurrentSceneCollection(networks)
    } else if (args[0] === 1) {
        setCurrentSceneCollection(networks, path[0])
    }
}

async function getSceneCollectionList(networks, sendOSC = true) {
    const sceneCollectionListPath = '/sceneCollection'
    try {
        const { sceneCollections } = await networks.obs.call('GetSceneCollectionList')
        if (sendOSC) {
            try {
                networks.oscOut.send(sceneCollectionListPath, sceneCollections)
            } catch (e) {
                if (DEBUG) console.error('getSceneCollectionList -- Failed to send scene collection list', e)
            }
        }
    } catch (e) {
        if (DEBUG) console.error('getSceneCollectionList -- Failed to get scene collection list:', e)
    }
}

async function setCurrentSceneCollection(networks, sceneCollectionName) {
    try {
        await networks.obs.call('SetCurrentSceneCollection', { sceneCollectionName })
    } catch (e) {
        if (DEBUG) console.error('setSceneCollectionList -- Failed to set current scene collection:', e)
    }
}

async function getCurrentSceneCollection(networks) {
    const currentSceneCollectionPath = '/sceneCollection/current'
    try {
        const { sceneCollectionName } = await networks.obs.call('GetSceneCollectionList')
        try {
            networks.oscOut.send(currentSceneCollectionPath, sceneCollectionName)
        } catch (e) {
            if (DEBUG) console.error('getCurrentSceneCollection -- Failed to send current scene collection:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getCurrentSceneCollection -- Failed to get current scene collection:', e)
    }
}

function sendCurrentSceneCollectionFeedback(networks, sceneCollectionName) {
    const currentSceneCollectionPath = '/sceneCollection/current'
    try {
        networks.oscOut.send(currentSceneCollectionPath, sceneCollectionName)
    } catch (e) {
        if (DEBUG) console.error('sendCurrentSceneCollectionFeedBack -- Failed to send current scene collection:', e)
    }
}