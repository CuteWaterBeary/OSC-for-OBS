const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const OBSWebSocket = require('obs-websocket-js')

const { open } = require('fs/promises')
const path = require('path')

const configPath = path.join(__dirname, 'config.json')
let autoConnect
let configJson = null
let obs

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

async function connectOBS(_event, ip, port, password) {
    console.info('Connecting OBSWebSocket...')
    console.info(`ip: ${ip}, port: ${port}, password: ${password}`)
    if (obs) {
        console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist' }
    }

    obs = new OBSWebSocket()
    try {
        const address = ip + ':' + port
        await obs.connect({ address: address, password: password })
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error }
    }

    await updateOBSConfig(ip, port, password)
    obs.on('error', err => {
        console.error('socket error:', err)
    })
    console.info('Connecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function disconnectOBS() {
    console.info('Disconnecting OBSWebSocket...')
    if (obs == null) {
        console.error('OBSWebSocket did not exist')
        return { result: false, error: 'OBSWebSocket did not exist' }
    }

    try {
        await obs.disconnect()
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error }
    }

    obs = null
    console.info('Disconnecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function updateOBSConfig(ip, port, password) {
    if (configJson == null) {
        console.error('Config not initialized')
        return
    }

    configJson.network.obsWebSocket = {
        ip: ip.toString(),
        port: port.toString(),
        password: password.toString(),
    }

    await saveConfig()
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
            configJson = { network: {}, misc: {} }
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
                { role: 'toggleDevTools' },
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
        width: 300,
        height: 800,
        minWidth: 300,
        minHeight: 800,
        useContentSize: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    })

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        mainWindow.webContents.openDevTools()
    })

    setApplicationMenu()
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(async () => {
    await loadConfig()
    ipcMain.handle('connect:obs', connectOBS)
    ipcMain.handle('disconnect:obs', disconnectOBS)
    ipcMain.handle('getConfig:obs', getConfig)
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
