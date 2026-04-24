const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { autoUpdater } = require("electron-updater");
const { crawlUrl } = require("./crawler");
const { inspectUrl } = require("./inspector");
const { runApiFinder } = require("./api-finder");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function setupAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("Auto update error:", error);
  });

  autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  setupAutoUpdate();
  createWindow();
  autoUpdater.checkForUpdates().catch((error) => {
    console.error("Failed to check updates:", error);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("crawl", async (_, url) => {
  return crawlUrl(url);
});

ipcMain.handle("app-version", async () => {
  return app.getVersion();
});

ipcMain.handle("inspect", async (_, payload) => {
  const { url, saveLog } = payload || {};
  const result = await inspectUrl(url);

  if (saveLog) {
    const stamp = new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
    const filePath = path.join(app.getPath("userData"), `inspector-${stamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
    return {
      ...result,
      logPath: filePath,
    };
  }

  return result;
});

ipcMain.handle("api-find", async (_, payload) => {
  const { url, keywordFilter } = payload || {};
  const logs = await runApiFinder(url, keywordFilter || "");
  return {
    success: true,
    logs,
  };
});
