const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;

function createNotchWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  const initialWidth = 140;
  const initialHeight = 12;
  const initialX = Math.round((screenWidth - initialWidth) / 2);

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");

  // Load the built frontend HTML
  const distPath = path.join(__dirname, "dist", "index.html");
  console.log("[Electron] Loading Notch UI from:", distPath);
  mainWindow.loadFile(distPath);

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  // Dynamic window resizing for Collapsed vs Expanded notch
  ipcMain.on("set-notch-state", (event, state) => {
    if (!mainWindow) return;

    const display = screen.getPrimaryDisplay();
    const currentScreenWidth = display.bounds.width;

    if (state === "expanded") {
      const targetWidth = 440;
      const targetHeight = 96;
      const targetX = Math.round((currentScreenWidth - targetWidth) / 2);
      mainWindow.setBounds({
        x: targetX,
        y: 0,
        width: targetWidth,
        height: targetHeight,
      });
    } else {
      const targetWidth = 140;
      const targetHeight = 12;
      const targetX = Math.round((currentScreenWidth - targetWidth) / 2);
      mainWindow.setBounds({
        x: targetX,
        y: 0,
        width: targetWidth,
        height: targetHeight,
      });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  console.log(`[Electron] Notch window active at X: ${initialX}, Y: 0 (${initialWidth}x${initialHeight})`);
}

// When Electron is ready
app.whenReady().then(() => {
  createNotchWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createNotchWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
