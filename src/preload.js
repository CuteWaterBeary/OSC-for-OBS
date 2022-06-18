const { contextBridge, ipcRenderer } = require('electron')

// contextBridge.exposeInMainWorld('electronAPI', {
//     setTitle: (title) => ipcRenderer.send('set-title', title),
//     openFile: () => ipcRenderer.invoke('dialog:openFile'),
//     handleCounter: (callback) => ipcRenderer.on('update-counter', callback)
// })

// window.addEventListener('DOMContentLoaded', () => {
//     const replaceText = (selector, text) => {
//         const element = document.querySelector(selector)
//         if (element) element.innerText = text
//     }

//     for (const depencency of ['chrome', 'node', 'electron']) {
//         replaceText(`#${depencency}-version`, process.versions[depencency])
//     }
// })
