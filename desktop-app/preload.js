const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onServerStatus: (callback) => ipcRenderer.on('server-status', (event, data) => callback(data))
});
