const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  crawl: (url) => ipcRenderer.invoke("crawl", url),
  getVersion: () => ipcRenderer.invoke("app-version"),
  getParsers: () => ipcRenderer.invoke("parser-list"),
  inspect: (payload) => ipcRenderer.invoke("inspect", payload),
  apiFind: (payload) => ipcRenderer.invoke("api-find", payload),
});
