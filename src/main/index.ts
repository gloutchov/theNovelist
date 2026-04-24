import { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { registerIpcHandlers } from './ipc';
import { ProjectSessionManager } from './projects/session';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectSessionManager = new ProjectSessionManager();
const ABOUT_COPYRIGHT = 'Copyright © 2026 Gloutchov';
let aboutWindow: BrowserWindow | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveAppLogoDataUrl(): Promise<string> {
  try {
    const icon = await app.getFileIcon(process.execPath, {
      size: 'large',
    });
    if (!icon.isEmpty()) {
      return icon.toDataURL();
    }
  } catch {
    // Fall through to a generated placeholder if file icon lookup fails.
  }

  return nativeImage.createEmpty().toDataURL();
}

async function openAboutWindow(parentWindow?: BrowserWindow): Promise<void> {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }

  const logoDataUrl = await resolveAppLogoDataUrl();
  const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>Info</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(90, 126, 255, 0.18), transparent 50%),
          linear-gradient(180deg, #f7f9fc 0%, #eef2f7 100%);
        color: #1f2937;
      }
      .card {
        width: 100%;
        max-width: 320px;
        padding: 28px 24px;
        box-sizing: border-box;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
        text-align: center;
      }
      .logo {
        width: 84px;
        height: 84px;
        display: block;
        margin: 0 auto 18px;
        object-fit: contain;
        filter: drop-shadow(0 10px 18px rgba(37, 99, 235, 0.18));
      }
      h1 {
        margin: 0 0 8px;
        font-size: 1.5rem;
        font-weight: 700;
      }
      .meta {
        margin: 0;
        font-size: 0.96rem;
        line-height: 1.6;
        color: #475569;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <img class="logo" src="${logoDataUrl}" alt="Logo The Novelist" />
      <h1>${escapeHtml(app.getName())}</h1>
      <p class="meta">Versione ${escapeHtml(app.getVersion())}</p>
      <p class="meta">${escapeHtml(ABOUT_COPYRIGHT)}</p>
    </main>
  </body>
</html>`;

  aboutWindow = new BrowserWindow({
    width: 360,
    height: 340,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Info',
    parent: parentWindow,
    modal: Boolean(parentWindow),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  aboutWindow.removeMenu();
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
  aboutWindow.once('ready-to-show', () => {
    aboutWindow?.show();
  });

  void aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function showAppInfo(parentWindow?: BrowserWindow): void {
  if (process.platform === 'darwin') {
    app.showAboutPanel();
    return;
  }

  void openAboutWindow(parentWindow);
}

function installApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [];
  const windowSubmenu: Electron.MenuItemConstructorOptions[] = [{ role: 'minimize' }, { role: 'zoom' }];

  if (process.platform === 'darwin') {
    windowSubmenu.push({ role: 'front' });
    template.push({
      label: app.getName(),
      submenu: [
        {
          label: 'Info',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
            showAppInfo(focusedWindow);
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(
    {
      label: 'File',
      submenu: [process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }],
    },
    {
      label: 'Window',
      submenu: windowSubmenu,
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Info',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
            showAppInfo(focusedWindow);
          },
        },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  installApplicationMenu();
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
