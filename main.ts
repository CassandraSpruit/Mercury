import { app, BrowserWindow, screen, ipcMain, Tray, Menu } from 'electron';
import * as path from 'path';
import * as url from 'url';

let win: BrowserWindow, serve, tray: Tray;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

function createWindow() {

    const electronScreen = screen;
    const size = electronScreen.getPrimaryDisplay().workAreaSize;
    // Create the browser window.
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        webPreferences: {
            nodeIntegration: true,
        },
        frame: false
    });

    if (serve) {
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/node_modules/electron`)
        });
        win.loadURL('http://localhost:4200');
    } else {
        win.loadURL(url.format({
            pathname: path.join(__dirname, 'dist/index.html'),
            protocol: 'file:',
            slashes: true
        }));
    }

    if (serve) {
        win.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store window
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });

    // IPC Renderer actions
    ipcMain.on('app:quit', () => {
        win = null;
        app.quit();
    });

    ipcMain.on('app:minimize', () => {
        win.minimize();
    });

    ipcMain.on('app:maximize', () => {
        win.restore();
    });

    ipcMain.on('app:fullscreen', () => {
        win.maximize();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'src/favicon.ico'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Mercury', type: 'normal', }
    ]);

    tray.setContextMenu(contextMenu);
}

try {

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', () => {
        createWindow();
        createTray();
    });

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });

    // Set AppUserModelId to enable notfications in windows
    app.setAppUserModelId(process.execPath);
} catch (e) {
    // Catch Error
    // throw e;
}