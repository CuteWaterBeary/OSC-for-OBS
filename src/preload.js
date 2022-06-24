const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    connectAll: (obsConfig, oscInConfig, oscOutConfig) => ipcRenderer.invoke('connect:all', obsConfig, oscInConfig, oscOutConfig),
    disconnectAll: () => ipcRenderer.invoke('disconnect:all'),
    cancelConnections: (callback) => ipcRenderer.on('disconnect:cancel', callback),
    getConfig: () => ipcRenderer.invoke('getConfig:obs'),
    updateMiscConfig: (key, config) => ipcRenderer.send('updateConfig:misc', key, config)
})
