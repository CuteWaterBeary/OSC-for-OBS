const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')

const { open } = require('fs/promises')
const path = require('path')
const { connectOBS, disconnectOBS, connectOSC, disconnectOSC } = require('./networks')

const configPath = path.join(__dirname, 'config.json')
const windowHeight = 700

let autoConnect
let isConfigModified = false
let configJson = null


let mainWindowId
let devWindowId

function saveAsFile() {
    console.info('saveAsFile triggered')
}

function openFile() {
    console.info('openFile triggered')
}

function openFileConnect() {
    console.info('openFileConnect triggered')
}

function openOriginalFile() {
    console.info('openOriginalFile triggered')
}

function qlabCue() {
    console.info('qlabCue triggered')
}

function listSceneItems() {
    console.info('listSceneItems triggered')
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
    const obsResult = await connectOBS(obsConfig)
    if (obsResult.result === false) {
        return obsResult
    }

    const oscResult = await connectOSC(oscInConfig, oscOutConfig)
    return oscResult
}

async function disconnectAll() {
    await disconnectOBS()
    await disconnectOSC()
}


function updateNetworkConfig(obsConfig, oscInConfig, oscOutConfig) {
    if (configJson === null) {
        console.error('Config not initialized')
        return
    }

    if (!configJson.network.obsWebSocket || !configJson.network.oscIn || !configJson.network.oscOut) {
        configJson.network.obsWebSocket = obsConfig
        configJson.network.oscIn = oscInConfig
        configJson.network.oscOut = oscOutConfig
        isConfigModified = true
        return
    }

    for (const key in Object.keys(obsConfig)) {
        if (configJson.network.obsWebSocket[key] != obsConfig[key]) {
            configJson.network.obsWebSocket = obsConfig
            isConfigModified = true
            break
        }
    }

    for (const key in Object.keys(oscInConfig)) {
        if (configJson.network.oscIn[key] != oscInConfig[key]) {
            configJson.network.oscIn = oscInConfig
            isConfigModified = true
            break
        }
    }

    for (const key in Object.keys(oscOutConfig)) {
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
                console.error('Invalid config file, set to default one')
                configJson = { openDevToolsOnStart: true, network: {}, misc: {} }
                isConfigModified = true
            }
        } catch (e) {
            console.error('Cannot parse config file, set to default one')
            configJson = { openDevToolsOnStart: true, network: {}, misc: {} }
            isConfigModified = true
        }

    } catch (e) {
        console.error('Error occurred when reading config:', e.message)
        configJson = { openDevToolsOnStart: true, network: {}, misc: {} }
        isConfigModified = true
        await showConfigDialog()
        await saveConfig()
    } finally {
        await fileHandle?.close()
    }
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
        console.error('Error occurred when saving config:', e.message)
    } finally {
        await fileHandle?.close()
    }
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
                isMac ? { role: 'close' } : { role: 'quit' },
                {
                    label: 'Save As...',
                    accelerator: 'Shift+CommandOrControl+s',
                    click: () => saveAsFile()
                },
                {
                    label: 'Open',
                    accelerator: 'CommandOrControl+o',
                    click: () => openFile()

                },
                {
                    label: 'Open/Connect',
                    accelerator: 'CommandOrControl+Shift+o',
                    click: () => openFileConnect()

                },
                {
                    label: 'Automatically Connect on Startup',
                    type: 'checkbox',
                    checked: false,
                    click: (item) => {
                        if (item.checked == false) {
                            autoConnect = false
                        } else if (item.checked == true) {
                            autoConnect = true
                        }
                    }
                },
                {
                    label: 'Revert to Default Values',
                    accelerator: 'CommandOrControl+Shift+/',
                    click: () => openOriginalFile()
                }
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
                {
                    label: 'Open DevTools At Startup',
                    type: 'checkbox',
                    checked: configJson.openDevToolsOnStart ? configJson.openDevToolsOnStart : true,
                    click: (item) => {
                        isConfigModified = true
                        if (item.checked) {
                            configJson.openDevToolsOnStart = true
                        } else {
                            configJson.openDevToolsOnStart = false
                        }
                    }
                },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
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
                },
                {
                    label: 'Test script',
                    click: async () => loadConfig()
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
        console.error('Main window do not exist')
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
    await loadConfig()
    ipcMain.handle('connect:all', connectAll)
    ipcMain.handle('disconnect:all', disconnectAll)
    ipcMain.handle('getConfig:obs', getConfig)
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    setInterval(checkConfigState, 1000)
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
