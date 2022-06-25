const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')

const { open } = require('fs/promises')
const path = require('path')
const { connectOBS, disconnectOBS, connectOSC, disconnectOSC, setUpOBSOSC, syncMiscConfig } = require('./networks')

const DEBUG = process.argv.includes('--enable-log')
const configPath = path.join(__dirname, 'config.json')
const windowHeight = 700
const defaultConfig = {
    openDevToolsOnStart: true,
    reconnectOBSOnDisconnect: true,
    network: {}, misc: {}
}

let isConfigModified = false
let configJson = null

let mainWindowId
let devWindowId

function updateMiscConfig(_event, key, config) {
    if (configJson.misc.hasOwnProperty(key) && configJson.misc[key] === config) {
        return
    }

    configJson.misc[key] = config
    isConfigModified = true

    syncMiscConfig(configJson.misc)
}

async function resetApp() {
    const result = await dialog.showMessageBox({
        message: 'OSC for OBS will reset all settings, are you sure?',
        type: 'question',
        buttons: ['Yes', 'No'],
    })

    if (result.response === 1) {
        if (DEBUG) console.info('App reset canceled')
        return
    }

    isConfigModified = false
    configJson = defaultConfig
    await saveConfig()
    if (DEBUG) console.info('App config has been reset, restarting...')
    app.relaunch()
    app.quit()
}

function qlabCue() {
    if (DEBUG) console.info('qlabCue triggered')
}

function listSceneItems() {
    if (DEBUG) console.info('listSceneItems triggered')
}

function toggleDevWindow() {
    const devWindow = devWindowId ? BrowserWindow.fromId(devWindowId) : null
    const mainWindow = BrowserWindow.fromId(mainWindowId)

    if (devWindow) {
        mainWindow.removeAllListeners('move')
        devWindow.close()
    } else {
        createDevWindow()
    }
}

async function connectAll(_event, obsConfig, oscInConfig, oscOutConfig) {
    updateNetworkConfig(obsConfig, oscInConfig, oscOutConfig)
    if (configJson.reconnectOBSOnDisconnect !== false) {
        obsConfig.autoReconnect = true
    }
    obsConfig.mainWindowId = mainWindowId

    const obsResult = await connectOBS(obsConfig)
    if (obsResult.result === false) {
        return obsResult
    }

    const oscResult = await connectOSC(oscInConfig, oscOutConfig)
    if (oscResult.result) {
        setUpOBSOSC()
    }
    return oscResult
}

async function disconnectAll() {
    await disconnectOBS()
    await disconnectOSC()
}


function updateNetworkConfig(obsConfig, oscInConfig, oscOutConfig) {
    if (configJson === null) {
        if (DEBUG) console.error('Config not initialized')
        return
    }

    if (!configJson.network.obsWebSocket || !configJson.network.oscIn || !configJson.network.oscOut) {
        configJson.network.obsWebSocket = obsConfig
        configJson.network.oscIn = oscInConfig
        configJson.network.oscOut = oscOutConfig
        isConfigModified = true
        return
    }

    for (const key in obsConfig) {
        if (configJson.network.obsWebSocket[key] != obsConfig[key]) {
            configJson.network.obsWebSocket = obsConfig
            isConfigModified = true
            break
        }
    }

    for (const key in oscInConfig) {
        if (configJson.network.oscIn[key] != oscInConfig[key]) {
            configJson.network.oscIn = oscInConfig
            isConfigModified = true
            break
        }
    }

    for (const key in oscOutConfig) {
        if (configJson.network.oscOut[key] != oscOutConfig[key]) {
            configJson.network.oscOut = oscOutConfig
            isConfigModified = true
            break
        }
    }
}

async function loadConfig() {
    let fileHandle
    let configString
    try {
        fileHandle = await open(configPath, 'r')
        configString = await fileHandle.readFile('utf-8')
        try {
            configJson = JSON.parse(configString)
            if (typeof (configJson) !== 'object') {
                if (DEBUG) console.error('Invalid config file, set to default one')
                configJson = defaultConfig
                isConfigModified = true
            }
        } catch (e) {
            if (DEBUG) console.error('Cannot parse config file, set to default one')
            configJson = defaultConfig
            isConfigModified = true
        }

    } catch (e) {
        if (DEBUG) console.error('Error occurred when reading config:', e.message)
        configJson = defaultConfig
        isConfigModified = true
        await showConfigDialog()
        await saveConfig()
    } finally {
        await fileHandle?.close()
    }

    syncMiscConfig(configJson.misc)
}

async function getConfig() {
    return configJson
}

async function saveConfig() {
    let fileHandle
    let configString
    try {
        fileHandle = await open(configPath, 'w+')
        configString = JSON.stringify(configJson)
        await fileHandle.truncate(0) // Wipe previous config
        await fileHandle.write(configString, 0)
        isConfigModified = false
    } catch (e) {
        if (DEBUG) console.error('Error occurred when saving config:', e.message)
    } finally {
        await fileHandle?.close()
    }

    if (DEBUG) console.info('Config file saved')
}

async function checkConfigState() {
    if (isConfigModified) await saveConfig()
}

async function showConfigDialog() {
    const dialogMessage = `App settings will be automatically saved to:
\n${configPath.toString()}
\nIf you saw this message multiple times, please check your antivirus or system settings.`
    await dialog.showMessageBox({
        message: dialogMessage,
        type: 'info',
        title: 'Auto Save Reminder'
    })
}

function setApplicationMenu() {
    const isMac = process.platform === 'darwin'
    const menuTemplate = [
        ...(isMac ? [{
            label: "OBSosc",
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'Auto Reconnect OBS Websocket',
                    type: 'checkbox',
                    checked: configJson.hasOwnProperty('reconnectOBSOnDisconnect') ? configJson.reconnectOBSOnDisconnect : true,
                    click: (item) => {
                        isConfigModified = true
                        if (item.checked) {
                            configJson.reconnectOBSOnDisconnect = true
                        } else {
                            configJson.reconnectOBSOnDisconnect = false
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Reset to Default',
                    click: async () => resetApp()
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' },
                            { role: 'stopSpeaking' }
                        ]
                    }
                ] : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                {
                    label: 'Toggle Develepoer Tools',
                    accelerator: 'CommandOrControl+Shift+I',
                    click: () => toggleDevWindow()
                },
                { type: 'separator' },
                {
                    label: 'Open DevTools on Startup',
                    type: 'checkbox',
                    checked: configJson.hasOwnProperty('openDevToolsOnStart') ? configJson.openDevToolsOnStart : true,
                    click: (item) => {
                        isConfigModified = true
                        if (item.checked) {
                            configJson.openDevToolsOnStart = true
                        } else {
                            configJson.openDevToolsOnStart = false
                        }
                    }
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        {
            label: 'Scripts',
            submenu: [
                {
                    label: 'Populate QLab OSC Cues From OBS Scenes',
                    accelerator: 'CommandOrControl+1',
                    click: () => qlabCue()
                },
                {
                    label: 'Log All Available Scene Items (Sources)',
                    accelerator: 'CommandOrControl+2',
                    click: () => listSceneItems()
                }
            ]
        },
    ]

    const menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 320,
        height: windowHeight,
        maximizable: false,
        fullscreenable: false,
        useContentSize: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    })

    mainWindowId = mainWindow.id
    setApplicationMenu()
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.loadFile(path.join(__dirname, 'index.html'))
    if (configJson.openDevToolsOnStart !== false) {
        createDevWindow()
    }
}

function createDevWindow() {
    const devWindow = new BrowserWindow({
        resizable: false,
        width: 480,
        height: windowHeight,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        show: false
    })
    const mainWindow = BrowserWindow.fromId(mainWindowId)

    if (mainWindow === null) {
        if (DEBUG) console.error('Main window do not exist')
        return
    }

    devWindow.setParentWindow(mainWindow)
    devWindowId = devWindow.id
    devWindow.removeMenu()
    mainWindow.webContents.setDevToolsWebContents(devWindow.webContents)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    mainWindow.on('move', function () {
        const windowBounds = mainWindow.getBounds()
        const devWindow = BrowserWindow.fromId(devWindowId)
        devWindow.setPosition(windowBounds.x + windowBounds.width, windowBounds.y)
    })

    devWindow.once('ready-to-show', () => {
        const windowBounds = mainWindow.getBounds()
        devWindow.setPosition(windowBounds.x + windowBounds.width, windowBounds.y)
        devWindow.setSize(windowBounds.width * 1.5, windowBounds.height)
        devWindow.show()
    })
}

app.whenReady().then(async () => {
    if (DEBUG) console.info('app arguments:', process.argv.includes('--enable-log'))
    await loadConfig()
    ipcMain.handle('connect:all', connectAll)
    ipcMain.handle('disconnect:all', disconnectAll)
    ipcMain.handle('getConfig:obs', getConfig)
    ipcMain.on('updateConfig:misc', updateMiscConfig)
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    setInterval(checkConfigState, 1000)
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
