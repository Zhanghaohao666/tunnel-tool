const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tunnelAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (rules) => ipcRenderer.invoke('config:save', rules),

  // Proxy
  startProxy: (rule) => ipcRenderer.invoke('proxy:start', rule),
  stopProxy: (id) => ipcRenderer.invoke('proxy:stop', id),
  proxyStatus: () => ipcRenderer.invoke('proxy:status'),

  // Tunnel
  startTunnel: (rule) => ipcRenderer.invoke('tunnel:start', rule),
  stopTunnel: (id) => ipcRenderer.invoke('tunnel:stop', id),
  tunnelStatus: () => ipcRenderer.invoke('tunnel:status'),

  // Certificates
  certStatus: () => ipcRenderer.invoke('cert:status'),
  generateCertificate: () => ipcRenderer.invoke('cert:generate'),
  trustCertificate: () => ipcRenderer.invoke('cert:trust'),
  importCertificatePair: (pair) => ipcRenderer.invoke('cert:import', pair),
  openCertificateFolder: () => ipcRenderer.invoke('cert:openFolder'),

  // File dialog
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
});
