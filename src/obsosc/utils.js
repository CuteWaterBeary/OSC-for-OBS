module.exports = { mergeSettings, parseSettingsPath }

function mergeSettings(defaultSettings, currentSettings) {
    for (setting in currentSettings) {
        if (typeof (currentSettings[setting]) === 'object' && defaultSettings[setting]) {
            mergeSettings(currentSettings[setting], defaultSettings[setting])
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
