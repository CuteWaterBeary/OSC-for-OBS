const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    connectAll: (obsConfig, oscInConfig, oscOutConfig) => ipcRenderer.invoke('connect:all', obsConfig, oscInConfig, oscOutConfig),
    disconnectAll: () => ipcRenderer.invoke('disconnect:all'),
    getConfig: () => ipcRenderer.invoke('getConfig:obs'),
    cancelConnections: (callback) => ipcRenderer.on('disconnect:cancel', callback)
})
