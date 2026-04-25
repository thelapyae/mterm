const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('termAPI', {
    spawnPTY: (size) => ipcRenderer.send('spawn-pty', size),
    sendInput: (data) => ipcRenderer.send('pty-input', data),
    sendResize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),
    onOutput: (callback) => ipcRenderer.on('pty-output', (_, data) => callback(data)),
    log: (msg) => ipcRenderer.send('renderer-log', msg)
});
