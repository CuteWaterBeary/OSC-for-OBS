const { getSceneList } = require('./scene')
const { getInputList } = require('./input')

module.exports = { processSource }

const DEBUG = process.argv.includes('--enable-log')

// TODO: Add filter related functions
async function processSource(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSourceList(networks)
        } else {
            getSourceActive(networks, args[0])
        }
        return
    }

    if (path[1] === 'active') {
        getSourceActive(networks, path[0])
    }
}

async function getSourceList(networks) {
    const sourceListPath = '/source'
    const sceneList = await getSceneList(networks, false)
    const inputList = await getInputList(networks, false)
    if (sceneList === undefined || inputList === undefined) return

    const sourceList = [...sceneList.sort((a, b) => b.sceneIndex - a.sceneIndex).flatMap(scene => scene.sceneName), ...inputList.sort((a, b) => (a.inputName.toUpperCase() > b.inputName.toUpperCase()) ? 1 : -1).flatMap(input => input.inputName)]
    try {
        networks.oscOut.send(sourceListPath, sourceList)
    } catch (e) {
        if (DEBUG) console.error('getSourceList -- Failed to send source list:', e)
    }
}

async function getSourceActive(networks, sourceName) {
    const sourceActivePath = `/scene/${sourceName}/active`
    try {
        const { videoActive } = await networks.obs.call('GetSourceActive', { sourceName })
        try {
            networks.oscOut.send(sourceActivePath, videoActive ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getSourceActive -- Failed to send source active status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getSourceActive -- Failed to get source active status:', e)
    }
}
