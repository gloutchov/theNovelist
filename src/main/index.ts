import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { registerIpcHandlers } from './ipc';
import { ProjectSessionManager } from './projects/session';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectSessionManager = new ProjectSessionManager();
const ABOUT_COPYRIGHT = 'Copyright © 2026 Gloutchov';

function installWindowSecurityGuards(mainWindow: BrowserWindow, appEntryUrl: string): void {
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl === appEntryUrl) {
      return;
    }

    event.preventDefault();
  });
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];

  if (devServerUrl) {
    installWindowSecurityGuards(mainWindow, devServerUrl);
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Annulla', 'Esci'],
        defaultId: 0,
        cancelId: 0,
        title: 'Modifiche non salvate',
        message: 'Sono presenti modifiche non ancora persistite.',
        detail: 'Se chiudi ora, le modifiche locali ancora in bozza andranno perse.',
      });

      if (choice === 1) {
        event.preventDefault();
      }
    });
    return;
  }

  const appEntryPath = path.join(__dirname, '../renderer/index.html');
  const appEntryUrl = pathToFileURL(appEntryPath).toString();
  installWindowSecurityGuards(mainWindow, appEntryUrl);
  void mainWindow.loadFile(appEntryPath);
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Annulla', 'Esci'],
      defaultId: 0,
      cancelId: 0,
      title: 'Modifiche non salvate',
      message: 'Sono presenti modifiche non ancora persistite.',
      detail: 'Se chiudi ora, le modifiche locali ancora in bozza andranno perse.',
    });

    if (choice === 1) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: ABOUT_COPYRIGHT,
  });

  registerIpcHandlers(ipcMain, projectSessionManager);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    projectSessionManager.closeProject();
    app.quit();
  }
});

app.on('before-quit', () => {
  projectSessionManager.closeProject();
});
