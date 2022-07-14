module.exports = {processSource, getSourceList}

const DEBUG = process.argv.includes('--enable-log')

async function processSource(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getSourceList(networks)
        } else {
            // Note: Might be removed later
            getSourceActive(networks, args[0])
        }
        return
    }

    if (path[1] === undefined) return

    // TODO: Change path from /source/[source]/[setting] to /source/[source]/setting/[setting]
    if (path[1] === 'setting' && DEBUG) {
        getSourceSettings(networks, path[0])
        return
    } else {
        // if (args[0] === undefined) {
        //     getSourceSetting(path[0], path[1])
        // } else {
        //     setSourceSetting(path[0], path[1], args[0])
        // }
    }
}

async function getSourceActive(networks, source) {
    const sourceActivePath = `/scene/${source}/active`
    try {
        const response = await networks.obs.send('GetSourceActive', { sourceName: source })
        try {
            networks.oscOut.send(sourceActivePath, response.sourceActive ? 1 : 0)
        } catch (e) {
            if (DEBUG) console.error('getSourceActive -- Failed to send source active status:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getSourceActive -- Failed to get source active status:', e)
    }
}

async function getSourceSettings(networks, source, sourceType) {
    try {
        const response = await networks.obs.send('GetSourceSettings', { sourceName: source, ...(sourceType !== undefined ? { sourceType: sourceType } : {}) })
        if (DEBUG) console.info(`${response.sourceName} - ${response.sourceType}:`, response.sourceSettings)
        return response.sourceSettings
    } catch (e) {
        if (DEBUG) console.error('getSourceSettings -- Failed to get source settings:', e)
    }
}

async function getSourceSetting(networks, source, setting) {
    const sourceSettingPath = `/source/${source}/${setting}`
    const sourceSettings = getSourceSettings(networks, source)
    if (!sourceSettings) return
    if (sourceSettings[setting] === undefined) {
        if (DEBUG) console.error('getSourceSetting -- No matched setting name:', setting)
        return
    }

    try {
        networks.oscOut.send(sourceSettingPath, sourceSettings[setting])
    } catch (e) {
        if (DEBUG) console.error(`getSourceSetting -- Failed to send source setting ${setting}:`, e)
    }
}

async function setSourceSetting(networks, source, setting, value, sourceType) {
    const sourceSettings = getSourceSettings(networks, source)
    if (!sourceSettings) return
    // Note: Due to how OBSWebSocket work, settings might not show up
    //       until it's been changed at least once in networks.OBS
    // if (sourceSettings[setting] === undefined) {
    //     if (DEBUG) console.error('setSourceSetting -- No matched setting name', setting)
    //     return
    // }

    sourceSettings[setting] = value
    try {
        const response = await networks.obs.send('SetSourceSettings', { sourceName: source, sourceSettings: sourceSettings, ...(sourceType !== undefined ? { sourceType: sourceType } : {}) })
    } catch (e) {
        if (DEBUG) console.error('getSourceSettings -- Failed to set source setting:', e)
    }
}

async function getSourceList(networks, sendOSC = true) {
    const sourceListPath = '/source'
    try {
        const response = await networks.obs.send('GetSourcesList')
        if (sendOSC) {
            const sourceList = response.sources.flatMap((source) => source.name)
            try {
                networks.oscOut.send(sourceListPath, sourceList)
            } catch (e) {
                if (DEBUG) console.error('getSourceList -- Failed to send source list:', e)
            }
        }
        return response.sources
    } catch (e) {
        if (DEBUG) console.error(`getSourceList -- Failed to get source list:`, e)
        return null
    }
}
