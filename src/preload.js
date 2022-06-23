const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    connectOBS: (obsIP, obsPort, obsPassword) => ipcRenderer.invoke('connect:obs', obsIP, obsPort, obsPassword),
    disconnectOBS: () => ipcRenderer.invoke('disconnect:obs'),
    updateConfig: () => ipcRenderer.invoke('updateConfig:obs'),
    getConfig: () => ipcRenderer.invoke('getConfig:obs')
})
