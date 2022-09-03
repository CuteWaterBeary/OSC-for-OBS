const { getCurrentProgramScene } = require('./scene')

const DEBUG = process.argv.includes('--enable-log')
const TEST = process.argv.includes('--unit-test')

if (TEST) {
    module.exports = { processSceneItem, getSceneItemList, getSceneAndSceneItemId, getSceneItemTransform, setSceneItemTransform, getSceneItemTransformValue, getSceneItemEnabled, setSceneItemEnabled, sendSceneItemFeedback }
} else {
    module.exports = { processSceneItem, getSceneItemList, sendSceneItemFeedback }
}

const keywords = ['transform', 'enable', 'disable']

async function processSceneItem(networks, path, args) {
    if (path[0] === undefined) {
        getSceneItemList(networks, args[0])
        return
    }

    for (let i = 1; i < 4; i++) {
        if (path[i] === undefined) return
        if (!keywords.includes(path[i])) continue

        if (path[i] === 'transform') {
            if (path[i + 1] === undefined) {
                getSceneItemTransform(networks, path.slice(0, i))
                return
            }

            if (args[0] === undefined) {
                getSceneItemTransformValue(networks, path.slice(0, i), path[i + 1])
            } else {
                setSceneItemTransform(networks, path.slice(0, i), path[i + 1], args[0])
            }
        } else if (path[i] === 'enable') {
            if (args[0] === 1 || args[0] === 0) {
                setSceneItemEnabled(networks, path.slice(0, i), args[0])
            } else if (args[0] === undefined) {
                getSceneItemEnabled(networks, path.slice(0, i))
            }
        } else if (path[i] === 'disable' && args[0] === 1) {
            setSceneItemEnabled(networks, path.slice(0, i), 0)
        }
        return
    }
}

async function getSceneItemList(networks, sceneName, sendOSC = true) {
    // Note: OBSWebSocket (v5 or above) could get sources under a group
    //       by GetGroupSceneItemList, but due to discouragement of
    //       the use (since group is somewhat broken), we are not 
    //       implement it for now.
    const sceneItemListPath = '/sceneItem'
    if (sceneName === undefined) {
        sceneName = await getCurrentProgramScene(networks, false)
    }

    try {
        const { sceneItems } = await networks.obs.call('GetSceneItemList', { sceneName })
        // NOTE: It seems that OBSWebSocket (v5.0.0 at this point) list scene items from bottom to top
        // TODO: Delete this line and use the sorting as is if that's preferable
        sceneItems.sort((a, b) => b.sceneItemIndex - a.sceneItemIndex)
        if (sendOSC) {
            const sceneItemList = sceneItems.flatMap(sceneItem => sceneItem.sourceName)

            try {
                // TODO: Add option to add scene name before source name
                networks.oscOut.send(sceneItemListPath, sceneItemList)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemList -- Failed to send scene item list', e)
            }
        }

        return sceneItems
    } catch (e) {
        if (DEBUG) console.error('getSceneItemList -- Failed to get scene item list', e)
    }
}

async function getSceneAndSceneItemId(networks, path) {
    let sceneName
    if (path.length === 1) {
        sceneName = await getCurrentProgramScene(networks, false)
    } else {
        sceneName = path.at(-2)
    }

    if (sceneName === undefined) { return {} }

    try {
        const { sceneItemId } = await networks.obs.call('GetSceneItemId', { sceneName, sourceName: path.at(-1) })
        return { sceneName, sceneItemId }
    } catch (e) {
        if (DEBUG) console.error('getSceneItemId -- Failed to get scene item ID:', e)
        return {}
    }
}

async function getSceneItemTransform(networks, path, sendOSC = true) {
    const sceneItemTransformPath = `/sceneItem/${path.join('/')}/transform`
    const { sceneName, sceneItemId } = await getSceneAndSceneItemId(networks, path)
    if (sceneItemId === undefined) return

    try {
        const { sceneItemTransform } = await networks.obs.call('GetSceneItemTransform', { sceneName, sceneItemId })
        if (sendOSC) {
            try {
                networks.oscOut.send(sceneItemTransformPath, Object.keys(sceneItemTransform))
            } catch (e) {
                if (DEBUG) console.error('getSceneItemTransform -- Failed to send scene item transform info:', e)
            }
        }

        return sceneItemTransform
    } catch (e) {
        if (DEBUG) console.error('getSceneItemTransform -- Failed to get scene item transform info:', e)
    }
}

async function setSceneItemTransform(networks, path, transform, value) {
    if (typeof (transform) !== 'string' || value === undefined) return
    const { sceneName, sceneItemId } = await getSceneAndSceneItemId(networks, path)
    if (sceneItemId === undefined) return

    const sceneItemTransform = {}
    sceneItemTransform[transform] = value
    try {
        await networks.obs.call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform })
    } catch (e) {
        if (DEBUG) console.error('setSceneItemTransform -- Failed to set scene item transform:', e)
    }
}

async function getSceneItemTransformValue(networks, path, transform, sendOSC = true) {
    const sceneItemTransformValuePath = `/sceneItem/${path.join('/')}/transform/${transform}`
    const sceneItemTransform = await getSceneItemTransform(networks, path, false)
    if (sceneItemTransform[transform] === undefined) return

    if (sendOSC) {
        try {
            networks.oscOut.send(sceneItemTransformValuePath, sceneItemTransform[transform])
        } catch (e) {
            if (DEBUG) console.error('getSceneItemTransformValue -- Failed to send scene item transform value:', e)
        }
    }

    return sceneItemTransform[transform]
}

async function getSceneItemEnabled(networks, path, sendOSC = true) {
    let sceneItemEnablePath = `/sceneItem/${path.join('/')}/enable`
    const { sceneName, sceneItemId } = await getSceneAndSceneItemId(networks, path)
    if (sceneItemId === undefined) return

    try {
        const { sceneItemEnabled } = await networks.obs.call('GetSceneItemEnabled', { sceneName, sceneItemId })
        if (sendOSC) {
            try {
                networks.oscOut.send(sceneItemEnablePath, sceneItemEnabled ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemEnabled -- Failed to send scene item enable state:', e)
            }
        }

        return sceneItemEnabled
    } catch (e) {
        if (DEBUG) console.error('getSceneItemEnabled -- Failed to get scene item enable state:', e)
    }
}

async function setSceneItemEnabled(networks, path, state) {
    const { sceneName, sceneItemId } = await getSceneAndSceneItemId(networks, path)
    if (sceneItemId === undefined) return
    try {
        await networks.obs.call('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: (state === 1) ? true : false })
    } catch (e) {
        if (DEBUG) console.error('setSceneItemEnabled -- Failed to set scene item enable state:', e)
    }
}

async function sendSceneItemFeedback(networks, sceneName) {
    await getSceneItemList(networks, sceneName)
}
