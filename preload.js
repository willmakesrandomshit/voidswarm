const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steam', { ach: id => ipcRenderer.send('ach', id) });
