// Electron entry point (desktop / Steam build)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Optional Steamworks integration. Install with `npm i steamworks.js` and replace 480 (Spacewar test app)
// with your own Steam App ID. If Steam isn't running or the module is missing, the game still works.
let steam = null;
try {
  const sw = require('steamworks.js');
  steam = sw.init(480);
  sw.electronEnableSteamOverlay();
} catch (e) { steam = null; }

ipcMain.on('ach', (_e, id) => { try { if (steam) steam.achievement.activate(id); } catch (e) { } });

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#05050c', autoHideMenuBar: true, title: 'VOIDSWARM',
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
