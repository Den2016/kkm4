// preload.js

const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded!');
console.log('contextBridge:', contextBridge);
console.log('ipcRenderer:', ipcRenderer);

// Изолируем API для безопасности
contextBridge.exposeInMainWorld('api', {
    send: (channel, args) => ipcRenderer.send(channel, args),
    on: (channel, listener) => ipcRenderer.on(channel, listener)
});