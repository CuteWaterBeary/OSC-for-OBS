const { getSceneList } = require('./scene')
const { getInputList } = require('./input')
const { parseSettingsPath, mergeSettings } = require('./utils')

const DEBUG = process.argv.includes('--enable-log')
const TEST = process.argv.includes('--unit-test')

if (TEST) {
    module.exports = { processSource, processSourceFilter, getSourceList, getSourceActive, getSourceFilterList, getSourceFilterSettings, setSourceFilterSettings, getSourceFilterDefaultSettings, getSourceFilterSetting, setSourceFilterSetting, getSourceFilter, getSourceFilterEnabled, setSourceFilterEnabled }
} else {
    module.exports = { processSource }
}

async function processSource(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSourceList(networks)
        } else {
            getSourceActive(networks, args[0])
        }
        return
    }

    if (path[1] === undefined) {
        getSourceActive(networks, path[0])
        return
    }

    if (path[1] === 'active') {
        getSourceActive(networks, path[0])
    } else if (path[1] === 'filters') {
        processSourceFilter(networks, path[0], path.slice(2), args)
    }
}

async function processSourceFilter(networks, sourceName, path, args) {
    // path format: [filter name]/[settings|enable|disable|reset]
    if (path[0] === undefined) {
        getSourceFilterList(networks, sourceName)
        return
    }

    if (path[1] === undefined) {
        if (args[0] === undefined) {
            getSourceFilterEnabled(networks, sourceName, path[0])
        } else {
            setSourceFilterEnabled(networks, sourceName, path[0], args[0])
        }
        return
    }

    if (path[1] === 'enable') {
        if (args[0] === undefined) {
            getSourceFilterEnabled(networks, sourceName, path[0])
        } else {
            setSourceFilterEnabled(networks, sourceName, path[0], args[0])
        }
    } else if (path[1] === 'disable' && args[0] === 1) {
        setSourceFilterEnabled(networks, sourceName, path[0], false)
    } else if (path[1] === 'settings') {
        if (path[2] === undefined) {
            getSourceFilterSettings(networks, sourceName, path[0])
            return
        }

        if (args[0] === undefined) {
            getSourceFilterSetting(networks, sourceName, path[0], path.slice(2))
        } else {
            setSourceFilterSetting(networks, sourceName, path[0], path.slice(2), args[0])
        }
    } else if (path[1] === 'reset') {
        setSourceFilterSettings(networks, sourceName, path[0], {}, false)
        setSourceFilterEnabled(networks, sourceName, path[0], 1)
    }
}

async function getSourceList(networks, sendOSC = true) {
    const sourceListPath = '/source'
    const sceneList = await getSceneList(networks, false)
    const inputList = await getInputList(networks, false)
    if (sceneList === undefined || inputList === undefined) return

    const sourceList = [...sceneList.sort((a, b) => b.sceneIndex - a.sceneIndex).flatMap(scene => scene.sceneName), ...inputList.sort((a, b) => (a.inputName.toUpperCase() > b.inputName.toUpperCase()) ? 1 : -1).flatMap(input => input.inputName)]
    if (sendOSC) {
        try {
            networks.oscOut.send(sourceListPath, sourceList)
        } catch (e) {
            if (DEBUG) console.error('getSourceList -- Failed to send source list:', e)
        }
    }

    return sourceList
}

async function getSourceActive(networks, sourceName, sendOSC = true) {
    const sourceActivePath = `/source/${sourceName}`
    try {
        const { videoActive } = await networks.obs.call('GetSourceActive', { sourceName })
        if (sendOSC) {
            try {
                networks.oscOut.send(sourceActivePath, videoActive ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error('getSourceActive -- Failed to send source active status:', e)
            }
        }

        return videoActive
    } catch (e) {
        if (DEBUG) console.error('getSourceActive -- Failed to get source active status:', e)
    }
}

async function getSourceFilterList(networks, sourceName, sendOSC = true) {
    const sourceFilterListPath = `/source/${sourceName}/filters`
    try {
        const { filters } = await networks.obs.call('GetSourceFilterList', { sourceName })
        if (sendOSC) {
            try {
                networks.oscOut.send(sourceFilterListPath, filters.flatMap(filter => filter.filterName))
            } catch (e) {
                if (DEBUG) console.error('getSourceFilterList -- Failed to send source filter list:', e)
            }
        }
        return filters
    } catch (e) {
        if (DEBUG) console.error('getSourceFilterList -- Failed to get source filter list:', e)
    }
}

async function getSourceFilterSettings(networks, sourceName, filterName, sendOSC = true) {
    const filterSettingsPath = `/source/${sourceName}/filters/${filterName}/settings`
    const filter = await getSourceFilter(networks, sourceName, filterName, false)
    const filterSettings = filter.filterSettings
    const defaultFilterSettings = await getSourceFilterDefaultSettings(networks, { filterKind: filter.filterKind }, false)

    mergeSettings(defaultFilterSettings, filterSettings)
    if (sendOSC) {
        try {
            networks.oscOut.send(filterSettingsPath, parseSettingsPath(defaultFilterSettings))
        } catch (e) {
            if (DEBUG) console.error('getSourceFilterSettings -- Failed to send filter settings:', e)
        }
    }

    return defaultFilterSettings
}

async function setSourceFilterSettings(networks, sourceName, filterName, filterSettings, overlay = true) {
    try {
        await networks.obs.call('SetSourceFilterSettings', { sourceName, filterName, filterSettings, overlay })
    } catch (e) {
        if (DEBUG) console.error(`setSourceFilterSettings -- Failed to get settings of filter ${filterName}:`, e)
    }
}

async function getSourceFilterDefaultSettings(networks, filterInfo, sendOSC = true) {
    // filterInfo: {sourceName, filterName, filterKind}
    if (filterInfo === undefined) return
    let filterKind = filterInfo.filterKind
    if (filterKind === undefined) {
        const filters = await getSourceFilterList(networks, filterInfo.sourceName, false)
        if (filter === undefined) return
        const filter = filters.find(filter => filter.filterName === filterInfo.filterName)
        if (filter === undefined) return
        filterKind = filter.filterKind
    }

    try {
        const { defaultFilterSettings } = await networks.obs.call('GetSourceFilterDefaultSettings', { filterKind })
        return defaultFilterSettings
    } catch (e) {
        if (DEBUG) console.error('getSourceFilterDefaultSettings -- Failed to get filter default settings:', e)
    }
}

async function getSourceFilterSetting(networks, sourceName, filterName, settingPath, sendOSC = true) {
    const filterSettingPath = `/source/${sourceName}/filters/${filterName}/settings/${settingPath.join('/')}`

    const filterSettings = await getSourceFilterSettings(networks, sourceName, filterName, false)
    let settingValue = filterSettings
    settingPath.forEach(subPath => {
        settingValue = settingValue[subPath]
    })

    if (settingValue === undefined) {
        if (DEBUG) console.error(`getSourceFilterSetting -- Setting ${settingPath.join('/')} not found in filter ${filterName}`)
        return
    }

    if (typeof (settingValue) === 'object') {
        if (DEBUG) console.error(`getSourceFilterSetting -- Setting ${settingPath.join('/')} in filter ${filterName} have subsettings`)
        return
    }

    if (sendOSC) {
        try {
            networks.oscOut.send(filterSettingPath, settingValue)
        } catch (e) {
            if (DEBUG) console.error(`getSourceFilterSetting -- Failed to send setting value of filter ${filterName}:`, e)
        }
    }

    return settingValue
}

async function setSourceFilterSetting(networks, sourceName, filterName, settingPath, settingValue) {
    if (settingPath.length === 0 || settingValue === undefined) return
    const filterSettings = {}
    let temp = filterSettings
    for (const subPath of settingPath.slice(0, -1)) {
        temp[subPath] = {}
        temp = temp[subPath]
    }
    temp[settingPath.at(-1)] = settingValue
    setSourceFilterSettings(networks, sourceName, filterName, filterSettings)
}

async function getSourceFilter(networks, sourceName, filterName, sendOSC = true) {
    const filterPath = `source/${sourceName}/filters/${filterName}`
    try {
        const response = await networks.obs.call('GetSourceFilter', { sourceName, filterName })
        if (sendOSC) {
            try {
                networks.oscOut.send(filterPath, response.filterEnabled ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error('getSourceFilter -- Failed to send filter settings:', e)
            }
        }

        return response
    } catch (e) {
        if (DEBUG) console.error('getSourceFilter -- Failed to get filter settings:', e)
    }
}

async function getSourceFilterEnabled(networks, sourceName, filterName, sendOSC = true) {
    const filterEnablePath = `source/${sourceName}/filters/${filterName}`
    const filter = await getSourceFilter(networks, sourceName, filterName, false)
    if (filter === undefined) return

    if (sendOSC) {
        try {
            networks.oscOut.send(filterEnablePath, filter.filterEnabled ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getSourceFilterEnabled -- Failed to get source filter enable state', e)
        }
    }

    return filter.filterEnabled
}

async function setSourceFilterEnabled(networks, sourceName, filterName, state) {
    try {
        await networks.obs.call('SetSourceFilterEnabled', { sourceName, filterName, filterEnabled: (state === 1) ? true : false })
    } catch (e) {
        if (DEBUG) console.error('setSourceFilterEnabled -- Failed to set filter enable state:', e)
    }
}
