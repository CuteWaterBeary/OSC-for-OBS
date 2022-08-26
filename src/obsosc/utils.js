if (process.argv.includes('--unit-test')) {
    module.exports = { mergeSettings, parseSettingsPath }
} else {
    module.exports = { mergeSettings, parseSettingsPath }
}

function mergeSettings(defaultSettings, currentSettings) {
    for (setting in currentSettings) {
        if (typeof (currentSettings[setting]) === 'object') {
            mergeSettings(defaultSettings[setting], currentSettings[setting])
        } else {
            defaultSettings[setting] = currentSettings[setting]
        }
    }
    return defaultSettings
}

function parseSettingsPath(settings) {
    const settingsPath = []
    for (const key in settings) {
        if (Object.hasOwnProperty.call(settings, key)) {
            if (typeof (settings[key]) === 'object') {
                const subKeys = parseSettingsPath(settings[key], key)
                subKeys.forEach(subKey => {
                    settingsPath.push(`${key}/${subKey}`)
                })
            } else {
                settingsPath.push(key)
            }
        }
    }
    return settingsPath
}
