const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ConfigManager = require('./config');
const CertificateManager = require('./certManager');
const ProxyManager = require('./proxy');
const TunnelManager = require('./tunnel');

// Prevent app from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err?.message || err);
});

const configManager = new ConfigManager(app.getPath('userData'));
const certManager = new CertificateManager(app.getPath('userData'));
const proxyManager = new ProxyManager({ certManager });
const tunnelManager = new TunnelManager();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  proxyManager.stopAll();
  tunnelManager.stopAll();
  app.quit();
});

// ─── Window controls ───
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// ─── Config ───
ipcMain.handle('config:get', () => configManager.getAll());
ipcMain.handle('config:save', (_, rules) => configManager.saveAll(rules));

// ─── Proxy ───
ipcMain.handle('proxy:start', async (_, rule) => {
  try {
    const result = await proxyManager.start(rule);
    return { ok: true, warning: result?.warning || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('proxy:stop', (_, id) => {
  proxyManager.stop(id);
  return { ok: true };
});

ipcMain.handle('proxy:status', () => proxyManager.status());

// ─── Certificates ───
ipcMain.handle('cert:status', async () => certManager.status());

ipcMain.handle('cert:generate', async () => {
  try {
    return await certManager.generate();
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('cert:trust', async () => {
  try {
    return await certManager.trust();
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('cert:import', async (_, pair) => {
  try {
    return await certManager.importPair(pair);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('cert:openFolder', async () => {
  try {
    return await certManager.openFolder();
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Tunnel ───
ipcMain.handle('tunnel:start', async (_, rule) => {
  try {
    await tunnelManager.start(rule);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('tunnel:stop', (_, id) => {
  tunnelManager.stop(id);
  return { ok: true };
});

ipcMain.handle('tunnel:status', () => tunnelManager.status());

// ─── File picker ───
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [],
  });
  return result.canceled ? null : result.filePaths[0];
});
