const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

const { open } = require('fs/promises')
const path = require('path')

const configPath = path.join(__dirname, 'config.json')
const windowHeight = 700

let autoConnect
let configJson = null

let obs
let oscIn
let oscOut

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
    const devWindow = BrowserWindow.fromId(devWindowId)
    const mainWindow = BrowserWindow.fromId(mainWindowId)

    if (devWindow) {
        mainWindow.removeAllListeners('move')
        devWindow.close()
    } else {
        createDevWindow()
    }
}

async function connectAll(_event, obsConfig, oscInConfig, oscOutConfig) {
    await updateConfig(obsConfig, oscInConfig, oscOutConfig)
    const obsResult = await connectOBS(obsConfig[0], obsConfig[1], obsConfig[2])
    if (obsResult.result === false) {
        return obsResult
    }

    const oscResult = await connectOSC(oscInConfig[0], oscInConfig[1], oscOutConfig[0], oscOutConfig[1])
    return oscResult
}

async function disconnectAll() {
    await disconnectOBS()
    await disconnectOSC()
}


async function updateConfig(obsConfig, oscInConfig, oscOutConfig) {
    if (configJson === null) {
        console.error('Config not initialized')
        return
    }

    configJson.network.obsWebSocket = {
        ip: obsConfig[0].toString(),
        port: obsConfig[1].toString(),
        password: obsConfig[2].toString()
    }

    configJson.network.oscIn = {
        ip: oscInConfig[0].toString(),
        port: oscInConfig[1].toString()
    }

    configJson.network.oscOut = {
        ip: oscOutConfig[0].toString(),
        port: oscOutConfig[1].toString()
    }

    await saveConfig()
}

async function connectOBS(ip, port, password) {
    console.info('Connecting OBSWebSocket...')
    console.info(`ip: ${ip}, port: ${port}, password: ${password}`)
    if (obs) {
        console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist', at: 'OBS WebSocket' }
    }

    obs = new OBSWebSocket()
    try {
        const address = ip + ':' + port
        await obs.connect({ address: address, password: password })
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        console.error('OBSWebSocket error:', err)
    })

    console.info('Connecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function disconnectOBS() {
    console.info('Disconnecting OBSWebSocket...')
    if (obs === null) {
        console.error('OBSWebSocket did not exist')
    }

    try {
        await obs.disconnect()
    } catch (e) {
        console.error('OBSWebSocket error:', e)
    }

    obs = null
    console.info('Disconnecting OBSWebSocket...Succeeded')
}

async function connectOSC(ipIn, portIn, ipOut, portOut) {
    try {
        oscIn = new Server(portIn, ipIn, () => {
            console.info('OSC server is listening')
        })

        oscIn.on('message', (message) => {
            console.info('New OSC message', message)
        })
    } catch (e) {
        console.error('Error occurred when starting OSC server:', e)
        return { result: false, error: e, at: 'OSC In' }
    }

    try {
        oscOut = new Client(ipOut, portOut)
        console.info('OSC client created')
    } catch (e) {
        console.error('Error occurred when starting OSC client:', e)
        return { result: false, error: e, at: 'OSC Out' }
    }

    return { result: true }
}

async function disconnectOSC() {
    if (oscIn) {
        try {
            oscIn.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC server:', e)
        }
    }

    if (oscOut) {
        try {
            oscOut.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC client:', e)
        }
    }

    oscIn = null
    oscOut = null
    console.info('OSC server/client stopped')
}

async function loadConfig() {
    let fileHandle
    let configString
    try {
        fileHandle = await open(configPath, 'r')
        configString = await fileHandle.readFile('utf-8')
        try {
            configJson = JSON.parse(configString)
        } catch (e) {
            console.error('Cannot parse config file, set a default one')
            configJson = { openDevToolsOnStart: true, network: {}, misc: {} }
            showConfigDialog()
        }

    } catch (e) {
        console.error('Error occurred when reading config', e.message)
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
        fileHandle = await open(configPath, 'r+')
        configString = JSON.stringify(configJson)
        await fileHandle.truncate(0) // Wipe previous config
        await fileHandle.write(configString, 0)
    } catch (e) {
        console.error(e.message)
    } finally {
        await fileHandle?.close()
    }
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
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
