const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    })

    const menu = Menu.buildFromTemplate([
        {
            label: app.name,
            submenu: [
                {
                    label: 'Increment',
                    click: () => mainWindow.webContents.send('update-counter', 1)
                },
                {
                    label: 'Decrement',
                    click: () => mainWindow.webContents.send('update-counter', -1)
                }
            ]
        }
    ])

    Menu.setApplicationMenu(menu)
    ipcMain.on('set-title', changeTitle)

    mainWindow.loadFile(path.join(__dirname, 'index.html'))
    mainWindow.webContents.openDevTools()
}

function changeTitle(event, title) {
    const webContent = event.sender
    const win = BrowserWindow.fromWebContents(webContent)
    win.setTitle(title)
}

async function openFile() {
    const { canceled, filePaths } = await dialog.showOpenDialog()
    if (canceled) {
        return
    }

    return filePaths[0]
}

app.whenReady().then(() => {
    ipcMain.handle('dialog:openFile', openFile)
    ipcMain.on('counter-value', (_event, value) => {
        console.info(`Value changed: ${value}`)
    })
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
