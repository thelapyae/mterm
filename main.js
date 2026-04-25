const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const path = require('path');
const os = require('os');

app.name = 'mterm';
if (process.platform === 'darwin' && !app.isPackaged) {
    try {
        app.dock.setIcon(path.join(__dirname, 'build/icon.png'));
    } catch (e) {}
}

let mainWindow;
let ptyProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        transparent: true,
        vibrancy: 'fullscreen-ui', // macOS blur effect
        titleBarStyle: 'hidden', // "Buttonless" feel (traffic lights only)
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.loadFile('renderer/index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        // Ready
    });

    ipcMain.on('spawn-pty', (event) => {
        if (ptyProcess) return; // Already spawned

        const shell = os.platform() === 'win32' 
            ? 'powershell.exe' 
            : (process.env.SHELL || (os.platform() === 'darwin' ? '/bin/zsh' : '/bin/bash'));

        const args = shell.includes('powershell') ? [] : ['-i'];

        // The shell needs a real folder to start in. In a packaged app, __dirname is an .asar archive
        // which the shell cannot read, causing it to instantly crash.
        const cwd = os.homedir();

        try {
            ptyProcess = pty.spawn(shell, args, {
                name: 'xterm-256color',
                cols: 120,
                rows: 40,
                cwd: cwd,
                env: {
                    ...process.env,
                    PATH: `${path.join(os.homedir(), '.mterm/bin')}:${process.env.PATH}`,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                    LANG: 'en_US.UTF-8', 
                }
            });
            console.log('PTY spawned successfully with PID:', ptyProcess.pid);

            ptyProcess.onData(data => {
                console.log('PTY -> Renderer:', data.length, 'bytes');
                if (mainWindow) {
                    mainWindow.webContents.send('pty-output', data);
                }
            });

            ptyProcess.onExit(() => {
                app.quit();
            });
        } catch (err) {
            console.error('Failed to spawn PTY:', err);
        }
    });

    ipcMain.on('pty-input', (_, data) => {
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    ipcMain.on('pty-resize', (_, { cols, rows }) => {
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
        }
    });

    ipcMain.on('renderer-log', (_, msg) => {
        console.log('\x1b[36m[Renderer]\x1b[0m', msg);
    });

    mainWindow.on('closed', () => {
        if (ptyProcess) {
            try { ptyProcess.kill(); } catch (e) {}
        }
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
