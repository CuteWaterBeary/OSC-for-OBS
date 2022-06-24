const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // connectOBS: (obsIP, obsPort, obsPassword) => ipcRenderer.invoke('connect:obs', obsIP, obsPort, obsPassword),
    // disconnectOBS: () => ipcRenderer.invoke('disconnect:obs'),
    connectAll: (obsConfig, oscInConfig, oscOutConfig) => ipcRenderer.invoke('connect:all', obsConfig, oscInConfig, oscOutConfig),
    disconnectAll: () => ipcRenderer.invoke('disconnect:all'),
    updateConfig: () => ipcRenderer.invoke('updateConfig:obs'),
    getConfig: () => ipcRenderer.invoke('getConfig:obs'),
    cancelConnections: (callback) => ipcRenderer.on('disconnect:cancel', callback)
})
