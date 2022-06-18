const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const { open } = require('fs/promises')
const path = require('path')
// const {}

const configPath = path.join(__dirname, 'config.json')
let autoConnect
let configJson

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

async function loadConfig() {
    let fileHandle
    let configString
    try {
        fileHandle = await open(configPath, 'r')
        configString = await fileHandle.readFile('utf-8')
        try {
            configJson = JSON.parse(configString)
        } catch (e) {
            console.error(e)
            configJson = JSON.parse('{}')
        }

        if (configJson.a != null) {
            configJson.a += 1
            console.info('a do exist')
        } else {
            configJson.a = 0
            console.info('a do not exist')
        }
        
        configString = JSON.stringify(configJson)
        await fileHandle.truncate(0) // Wipe previous config
        await fileHandle.write(configString, 0)
    } catch (e) {
        console.error(e.message)
    } finally {
        await fileHandle?.close()
    }
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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    })

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
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
    mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
