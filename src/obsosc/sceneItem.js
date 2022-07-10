module.exports = { processSceneItem }

const DEBUG = process.argv.includes('--enable-log')
const keywords = ['property', 'show', 'hide', 'reset']

async function processSceneItem(networks, path, args) {
    if (path[0] === undefined) {
        getSceneItemList(args[0])
        return
    }

    // if (path[1] === undefined) {
    //     // Might be removed later
    //     getSceneItemProperties(path)
    //     return
    // }

    // if (args[0] === undefined) {
    //     getSceneItemProperties(path)
    // }

    // path: [scene]/[source|group/source]/[property|show|reset]

    for (let i = 1; i < 4; i++) {
        if (path[i] === undefined) return
        if (!keywords.includes(path[i])) continue

        if (path[i] === 'property') {
            if (path[i + 1] === undefined) {
                getSceneItemProperties(networks, path.slice(0, i))
                return
            }

            if (args[0] === undefined) {
                getSceneItemProperty(networks, path.slice(0, i), path.slice(i + 1))
            } else {
                setSceneItemProperty(networks, path.slice(0, i), path.slice(i + 1), args)
            }
        } else if (path[i] === 'show') {
            if (args[0] === 1 || args[0] === 0) {
                setSceneItemRender(networks, path.slice(0, i), args[0])
            } else if (args[0] === undefined) {
                getSceneItemRender(networks, path.slice(0, i))
            }
        } else if (path[i] === 'hide' && args[0] === 1) {
            setSceneItemRender(networks, path.slice(0, i), 0)
        } else if (path[i] === 'reset' && args[0] === 1) {
            resetSceneItem(networks, path.slice(0, i))
        }
        return
    }
}

async function getSceneItemList(networks, scene, sendOSC = true) {
    const sceneItemListPath = '/sceneItem'
    try {
        const response = await networks.obs.send('GetSceneItemList', scene !== undefined ? { sceneName: scene } : undefined)
        if (sendOSC) {
            const sceneItemList = response.sceneItems.flatMap(sceneItem => sceneItem.sourceName)
            // Note: OBSWebSocket (v4.x) do not report sources under
            //       group and cannot be obtained from GetSceneItemProperties
            //       because SceneItemTransform have no name/item property
            try {
                // TODO: Add option to add scene name before source name
                networks.oscOut.send(sceneItemListPath, sceneItemList)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemList -- Failed to send scene item list', e)
            }
        }
        return response
    } catch (e) {
        if (DEBUG) console.error('getSceneItemList -- Failed to get scene item list', e)
    }
}

async function getSceneItemProperties(networks, path, sendOSC = true) {
    let sceneItemPropertiesPath = `/sceneItem/${path.join('/')}`
    // if (DEBUG) console.info('getSceneItemProperties -- feedback path:', sceneItemPropertiesPath)

    if (path.length === 0 || path.length > 3) {
        if (DEBUG) console.error('getSceneItemProperties -- Invalid path (too short or too long):', path.join('/'))
        return
    }

    let scene, sceneItem
    if (path.length === 1) {
        sceneItem = path[0]
    } else {
        scene = path[0]
        sceneItem = path.at(-1)
    }

    try {
        const response = await networks.obs.send('GetSceneItemProperties', { item: sceneItem, ...(scene !== undefined ? { 'scene-name': scene } : {}) })
        if (path.length === 3) {
            if (response.parentGroupName !== path[1]) {
                if (DEBUG) console.error('getSceneItemProperties -- Invalid path (wrong parent group):', path.join('/'))
                return
            }
        }

        if (sendOSC) {
            // TODO: Add option to send complete path
            if (false) {
                const sceneItemList = await getSceneItemList(networks, undefined, false)
                if (sceneItemList === undefined) {
                    if (DEBUG) console.error('getSceneItemRender -- Failed to get scene name from getSceneItemList')
                    return
                }
                sceneItemPropertiesPath = `/sceneItem/${sceneItemList.sceneName}${response.parentGroupName !== undefined ? '/' + response.parentGroupName : ''}/${response.name}`
            }

            try {
                const propertyList = parsePropertyList(response)
                networks.oscOut.send(sceneItemPropertiesPath, propertyList)
            } catch (e) {
                if (DEBUG) console.error('getSceneItemProperties -- Failed to send scene item properties:', e)
            }
        }
        return response
    } catch (e) {
        if (DEBUG) console.error('getSceneItemProperties -- Failed to get scene item properties:', e)
    }
}

function parsePropertyList(properties) {
    const propertyList = []

    for (const key in properties) {
        if (typeof (properties[key]) === 'object') {
            for (const subKey in properties[key]) {
                propertyList.push(`${key}/${subKey}`)
            }
        } else {
            propertyList.push(key)
        }
    }

    return propertyList
}

async function getSceneItemProperty(networks, path, propertyPath, sendOSC = true) {
    if (propertyPath === undefined || propertyPath.length === 0) return
    if (propertyPath.length > 3) {
        if (DEBUG) console.error('getSceneItemProperty -- Invalid property:', propertyPath.join('/'))
        return
    }
    let SceneItemPropertyPath = `/sceneItem/${path.join('/')}/property/${propertyPath.join('/')}`
    const properties = await getSceneItemProperties(networks, path, false)
    if (properties === undefined) return

    let property = properties
    for (const p of propertyPath) {
        property = property[p]
        if (property === undefined) {
            if (DEBUG) console.error('getSceneItemProperty -- Unknown property:', propertyPath.join('/'))
            return
        }
    }

    if (sendOSC) {
        // TODO: Add option to send complete path
        if (false) {
            const sceneItemList = await getSceneItemList(networks, undefined, false)
            if (sceneItemList === undefined) {
                if (DEBUG) console.error('getSceneItemProperty -- Failed to get scene name from getSceneItemList')
                return
            }
            SceneItemPropertyPath = `/sceneItem/${sceneItemList.sceneName}${properties.parentGroupName !== undefined ? '/' + properties.parentGroupName : ''}/${properties.name}/property/${propertyPath.join('/')}`
        }

        if (typeof (property) !== 'object') {
            try {
                networks.oscOut.send(SceneItemPropertyPath, property)
            } catch (e) {
                if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}:`, e)
            }
        } else {
            for (const key in property) {
                if (typeof (property[key]) === 'object') {
                    if (DEBUG) console.error(`getSceneItemProperty -- Property ${propertyPath.join('/')} is not a single-level object`)
                    return
                }
            }

            // TODO: Add option to toggle the path to send single-level object's values
            if (true) {
                for (const key in property) {
                    try {
                        networks.oscOut.send(SceneItemPropertyPath.concat('/', key), property[key])
                    } catch (e) {
                        if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}/${key}:`, e)
                    }
                }
            } else {
                try {
                    networks.oscOut.send(SceneItemPropertyPath, Object.values(property))
                } catch (e) {
                    if (DEBUG) console.error(`getSceneItemProperty -- Failed to send property ${propertyPath.join('/')}:`, e)
                }
            }
        }
    }

    return property
}

async function setSceneItemProperty(networks, path, propertyPath, args) {
    if (path.length === 0 || path.length > 3) {
        if (DEBUG) console.error('setSceneItemProperty -- Invalid path (too short or too long):', path.join('/'))
        return
    }
    if (propertyPath.length === 0 || propertyPath.length > 2) {
        if (DEBUG) console.error('setSceneItemProperty -- Invalid property path (too short or too long):', propertyPath.join('/'))
        return
    }

    const properties = await getSceneItemProperties(networks, path, false)
    if (properties === undefined) return

    if (path.length !== 1) {
        properties['scene-name'] = path[0]
    }
    properties.item = properties.name


    let property = properties
    let propertyParent
    for (const p of propertyPath) {
        propertyParent = property
        property = property[p]
        if (property === undefined) {
            if (DEBUG) console.error('setSceneItemProperty -- Unknown property:', propertyPath.join('/'))
            return
        }
    }

    if (typeof (property) !== 'object') {
        propertyParent[propertyPath.at(-1)] = args[0]
    } else if (true) {
        if (args.length !== Object.keys(property).length) {
            if (DEBUG) console.error(`setSceneItemProperty -- Number of arguments (${args.length}) not match the number of child properties (${Object.keys(property).length})`)
            return
        }
        let i = 0
        for (const key in property) {
            property[key] = args[i]
            i++
        }
    }

    try {
        await networks.obs.send('SetSceneItemProperties', properties)
    } catch (e) {
        if (DEBUG) console.error(`setSceneItemProperty -- Failed to set scene item property ${propertyPath.join('/')}:`, e)
    }
}

async function setSceneItemRender(networks, path, render) {
    const properties = await getSceneItemProperties(networks, path, false)
    if (properties === undefined) return

    try {
        networks.obs.send('SetSceneItemRender', { source: path.at(-1), render: render ? true : false, ...((path.length > 1) ? { 'scene-name': path[0] } : {}) })
    } catch (e) {
        if (DEBUG) console.error('setSceneItemRender -- Failed to set scene item render state:', e)
    }
}

async function getSceneItemRender(networks, path) {
    let sceneItemRenderPath = `/sceneItem/${path.join('/')}/show`
    const properties = await getSceneItemProperties(networks, path, false)
    if (properties === undefined) return

    // TODO: Add option to send complete path
    if (false) {
        const sceneItemList = await getSceneItemList(networks, undefined, false)
        if (sceneItemList === undefined) {
            if (DEBUG) console.error('getSceneItemRender -- Failed to get scene name from getSceneItemList')
            return
        }
        sceneItemRenderPath = `/sceneItem/${sceneItemList.sceneName}${properties.parentGroupName !== undefined ? '/' + properties.parentGroupName : ''}/${properties.name}/show`
    }

    try {
        networks.oscOut.send(sceneItemRenderPath, properties.visible ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error('setSceneItemRender -- Failed to send scene item render state:', e)
    }
}

async function resetSceneItem(networks, path) {
    const properties = await getSceneItemProperties(networks, path, false)
    if (properties === undefined) return

    try {
        await networks.obs.send('ResetSceneItem', { item: path.at(-1), ...((path.length > 1) ? { 'scene-name': path[0] } : {}) })
    } catch (e) {
        if (DEBUG) console.error('resetSceneItem -- Failed to reset scene item:', e)
    }
}