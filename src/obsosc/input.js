const { parseSettingsPath, mergeSettings } = require('./utils')

module.exports = { processInput, getInputList }

const DEBUG = process.argv.includes('--enable-log')

async function processInput(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getInputList(networks)
        }
        return
    }

    if (path[1] === 'settings') {
        if (path[2] === undefined) {
            getInputSettings(networks, path[0])
            return
        }

        if (args[0] === undefined) {
            if (path.at(-1) === 'propertyItems' && path.at(-2) !== 'settings') {
                getInputPropertiesListPropertyItems(networks, path[0], path.at(-2))
            } else {
                getInputSetting(networks, path[0], path.slice(2))
            }
        } else {
            setInputSetting(networks, path[0], path.slice(2), args[0])
        }
    } else if (path[1] === 'default') {
        if (path[2] === undefined) {
            getInputDefaultSettings(networks, path[0])
        } else {
            getInputDefaultSetting(networks, path[0], path.slice(2))
        }
    } else if (path[1] === 'press') {
        if (path[2] === undefined || args[0] !== 1) return
        pressInputPropertiesButton(networks, path[0], path[2])
    }
}

async function getInputList(networks, sendOSC = true) {
    const inputListPath = '/input'
    try {
        const { inputs } = await networks.obs.call('GetInputList')

        if (sendOSC) {
            try {
                networks.oscOut.send(inputListPath, inputs.flatMap(input => input.inputName))
            } catch (e) {
                if (DEBUG) console.error('getInputList -- Failed to send input list:', e)
            }
        }

        return inputs
    } catch (e) {
        if (DEBUG) console.error('getInputList -- Failed to get input list:', e)
    }
}

async function getInputKind(networks, inputName) {
    try {
        const { inputKind } = await networks.obs.call('GetInputSettings', { inputName })
        return inputKind
    } catch (e) {
        if (DEBUG) console.error(`getInputKind -- Failed to get input kind of input ${inputName}:`, e)
    }
}

async function getInputSettings(networks, inputName, sendOSC = true) {
    const inputSettingsPath = `/input/${inputName}/settings`
    try {
        const { inputSettings, inputKind } = await networks.obs.call('GetInputSettings', { inputName })
        const { defaultInputSettings } = await networks.obs.call('GetInputDefaultSettings', { inputKind })

        // Merge two settings since inputSettings do not contains any
        // setting not been modified yet and vise versa.
        mergeSettings(defaultInputSettings, inputSettings)
        if (sendOSC) {
            try {
                networks.oscOut.send(inputSettingsPath, parseSettingsPath(defaultInputSettings))
            } catch (e) {
                if (DEBUG) console.error(`getInputSettings -- Failed to send settings of input ${inputName}:`, e)
            }
        }
        return inputSettings
    } catch (e) {
        if (DEBUG) console.error(`getInputSettings -- Failed to get settings of input ${inputName}:`, e)
    }
}

async function setInputSettings(networks, inputName, inputSettings) {
    try {
        await networks.obs.call('SetInputSettings', { inputName, inputSettings })
    } catch (e) {
        if (DEBUG) console.error(`setInputSettings -- Failed to get settings of input ${inputName}:`, e)
    }
}

async function getInputSetting(networks, inputName, settingPath) {
    if (settingPath.length === 0) return
    const inputSettingPath = `/input/${inputName}/settings/${settingPath.join('/')}`
    const inputSettings = await getInputSettings(networks, inputName, false)
    let settingValue = inputSettings
    settingPath.forEach(subPath => {
        settingValue = settingValue[subPath]
    })

    if (settingValue === undefined) {
        if (DEBUG) console.error(`getInputSetting -- Setting ${settingPath.join('/')} not found in input ${inputName}`)
        return
    }

    try {
        networks.oscOut.send(inputSettingPath, settingValue)
    } catch (e) {
        if (DEBUG) console.error(`getInputSetting -- Failed to send setting value of input ${inputName}:`, e)
    }
}

async function setInputSetting(networks, inputName, settingPath, settingValue) {
    if (settingPath.length === 0 || settingValue === undefined) return
    const inputSettings = {}
    let temp = inputSettings
    for (const subPath of settingPath.slice(0, -1)) {
        temp[subPath] = {}
        temp = temp[subPath]
    }
    temp[settingPath.at(-1)] = settingValue
    setInputSettings(networks, inputName, inputSettings)
}

async function getInputDefaultSettings(networks, inputName, sendOSC = true) {
    const defaultSettingsPath = `/input/${inputName}/default`
    const inputKind = await getInputKind(networks, inputName)
    try {
        const { defaultInputSettings } = await networks.obs.call('GetInputDefaultSettings', { inputKind })
        if (sendOSC) {
            try {
                networks.oscOut.send(defaultSettingsPath, parseSettingsPath(defaultInputSettings))
            } catch (e) {
                if (DEBUG) console.error(`getInputDefaultSettings -- Failed to send settings of input ${inputName}:`, e)
            }
        }
        return defaultInputSettings
    } catch (e) {
        if (DEBUG) console.error(`getInputDefaultSettings -- Failed to get default setting of input ${inputName}:`, e)
    }
}

async function getInputDefaultSetting(networks, inputName, settingPath) {
    if (settingPath.length === 0) return
    const defaultSettingPath = `/input/${inputName}/default/${settingPath.join('/')}`
    const defaultInputSettings = await getInputDefaultSettings(networks, inputName, false)
    let settingValue = defaultInputSettings
    settingPath.forEach(subPath => {
        settingValue = settingValue[subPath]
    })

    if (settingValue === undefined) {
        if (DEBUG) console.error(`getInputDefaultSetting -- setting ${settingPath.join('/')} not found in input ${inputName}`)
        return
    }

    try {
        networks.oscOut.send(defaultSettingPath, settingValue)
    } catch (e) {
        if (DEBUG) console.error(`getInputDefaultSetting -- Failed to send setting value of input ${inputName}:`, e)
    }
}

async function getInputPropertiesListPropertyItems(networks, inputName, propertyName) {
    const inputPropertyItemsPath = `input/${inputName}/settings/${propertyName}/propertyItems`
    try {
        const { propertyItems } = await networks.obs.call('GetInputPropertiesListPropertyItems', { inputName, propertyName })
        try {
            networks.oscOut.send(inputPropertyItemsPath, propertyItems.flatMap(propertyItem => propertyItem.itemValue))
        } catch (e) {
            if (DEBUG) console.error(`getInputPropertiesListPropertyItems -- Failed to send property items of property ${propertyName} of input ${inputName}:`, e)
        }
    } catch (e) {
        if (DEBUG) console.error(`getInputPropertiesListPropertyItems -- Failed to get property items of property ${propertyName} of input ${inputName}:`, e)
    }
}

async function pressInputPropertiesButton(networks, inputName, propertyName) {
    try {
        await networks.obs.call('PressInputPropertiesButton', { inputName, propertyName })
    } catch (e) {
        if (DEBUG) console.error(`pressInputPropertiesButton -- Failed to press button of property ${propertyName} of input ${inputName}:`, e)
    }
}
