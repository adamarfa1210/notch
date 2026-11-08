const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn } = require("child_process");

// 1. Single Instance Lock to prevent duplicate processes & GPU cache contention
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// 2. Configure isolated user data directory and disable shader disk cache to avoid Windows access denied errors
app.setName("DynamicRamNotch");
const userDataPath = path.join(os.tmpdir(), "dynamic_ram_notch_profile");
if (!fs.existsSync(userDataPath)) {
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
  } catch {}
}
app.setPath("userData", userDataPath);
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("no-sandbox");

let mainWindow = null;
let tray = null;
let selectedDisplayId = null;
let collapseTimer = null;
let daemonProcess = null;

// Helper: Check if Rust Backend Daemon is already running on port 49152
function isDaemonRunning(callback) {
  const req = http.get("http://127.0.0.1:49152/health", (res) => {
    callback(res.statusCode === 200);
  });
  req.on("error", () => callback(false));
  req.setTimeout(600, () => {
    req.destroy();
    callback(false);
  });
}

// Helper: Automatically launch Rust Backend Daemon in background if needed
function startDaemonIfNeeded() {
  isDaemonRunning((running) => {
    if (running) {
      console.log("[Electron] Notch backend daemon is already active.");
      return;
    }

    let daemonExePath = "";
    if (app.isPackaged) {
      daemonExePath = path.join(process.resourcesPath, "notch-daemon.exe");
    } else {
      const releasePath = path.resolve(__dirname, "..", "src-tauri", "target", "release", "notch-daemon.exe");
      const debugPath = path.resolve(__dirname, "..", "src-tauri", "target", "debug", "notch-daemon.exe");
      daemonExePath = fs.existsSync(releasePath) ? releasePath : debugPath;
    }

    if (fs.existsSync(daemonExePath)) {
      try {
        daemonProcess = spawn(daemonExePath, [], {
          windowsHide: true,
          stdio: "ignore",
          detached: false,
        });
        console.log("[Electron] Successfully spawned Notch daemon silently:", daemonExePath);
      } catch (err) {
        console.error("[Electron] Failed to spawn Notch daemon:", err);
      }
    } else {
      console.warn("[Electron] Notch daemon binary not found at:", daemonExePath);
    }
  });
}

function stopDaemon() {
  if (daemonProcess && !daemonProcess.killed) {
    try {
      daemonProcess.kill();
    } catch {}
    daemonProcess = null;
  }
}

function getActiveDisplay() {
  const displays = screen.getAllDisplays();
  if (selectedDisplayId) {
    const found = displays.find((d) => d.id === selectedDisplayId);
    if (found) return found;
  }
  // Default to the Laptop screen (1440x900) if available!
  const laptop = displays.find((d) => d.bounds.width === 1440);
  if (laptop) return laptop;

  return screen.getPrimaryDisplay();
}

function positionWindow(width, height) {
  if (!mainWindow) return;
  const display = getActiveDisplay();
  const { x: displayX, y: displayY, width: displayWidth } = display.bounds;

  const targetX = Math.round(displayX + (displayWidth - width) / 2);
  const targetY = displayY;

  const current = mainWindow.getBounds();
  if (
    current.x === targetX &&
    current.y === targetY &&
    current.width === width &&
    current.height === height
  ) {
    return;
  }

  mainWindow.setBounds({
    x: targetX,
    y: targetY,
    width,
    height,
  });

  console.log(
    `[Notch] Positioned on Screen (${display.bounds.width}x${display.bounds.height}) at X: ${targetX}, Y: ${targetY} (Size: ${width}x${height})`
  );
}

function createNotchWindow() {
  const initialWidth = 180;
  const initialHeight = 30;
  const iconPath = fs.existsSync(path.join(__dirname, "icon.ico"))
    ? path.join(__dirname, "icon.ico")
    : path.join(__dirname, "tray-icon.ico");

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    show: false,
    icon: iconPath,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");

  // Position on laptop display
  positionWindow(initialWidth, initialHeight);
  mainWindow.show();

  // Load the built frontend HTML
  const distPath = path.join(__dirname, "dist", "index.html");
  console.log("[Electron] Loading Notch UI from:", distPath);
  mainWindow.loadFile(distPath);

  // 1. Dynamic window resizing for Collapsed vs Expanded notch (1-20 items progressive width)
  ipcMain.on("set-notch-state", (event, state, customWidth, customHeight) => {
    if (!mainWindow) return;

    if (state === "expanded") {
      // Instantly cancel any pending collapse timer to eliminate hover fight bug
      if (collapseTimer) {
        clearTimeout(collapseTimer);
        collapseTimer = null;
      }
      const w = typeof customWidth === "number" ? customWidth : 864;
      const h = typeof customHeight === "number" ? customHeight : 112;
      positionWindow(w, h);
    } else {
      if (collapseTimer) {
        clearTimeout(collapseTimer);
      }
      // Allow snappy spring animation (~200ms) to shrink inside canvas before tightening OS window
      collapseTimer = setTimeout(() => {
        if (mainWindow) {
          positionWindow(180, 30);
        }
        collapseTimer = null;
      }, 220);
    }
  });

  ipcMain.on("set-notch-dimensions", (event, width, height) => {
    if (!mainWindow) return;
    positionWindow(width, height);
  });

  // 2. Native OLE Drag-Out (Supports single item or batch of multiple items)
  ipcMain.on("start-drag-item", (event, itemOrItems) => {
    try {
      const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      const resolvedFiles = [];
      const tempDir = path.join(os.tmpdir(), "notch_export");

      for (const item of items) {
        if (!item) continue;
        let targetFilePath = null;

        if (item.item_type === "fileuri") {
          targetFilePath = item.data;

          // Robust resolution for Unicode, emojis, or relative paths:
          if (!fs.existsSync(targetFilePath)) {
            const folderAwal = path.resolve(__dirname, "..", "testing_dragdrop", "folder_awal");
            if (fs.existsSync(folderAwal)) {
              const files = fs.readdirSync(folderAwal);
              for (const f of files) {
                if (
                  f === item.preview ||
                  f.normalize("NFC") === item.preview.normalize("NFC") ||
                  f.includes(item.preview.slice(0, 20))
                ) {
                  targetFilePath = path.join(folderAwal, f);
                  break;
                }
              }
            }
          }
        } else if (item.item_type === "image") {
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          targetFilePath = path.join(tempDir, `notch_img_${item.id.slice(0, 8)}.png`);
          fs.writeFileSync(targetFilePath, Buffer.from(item.data, "base64"));
        } else if (item.item_type === "text") {
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          targetFilePath = path.join(tempDir, `notch_text_${item.id.slice(0, 8)}.txt`);
          fs.writeFileSync(targetFilePath, item.data, "utf8");
        }

        if (targetFilePath && fs.existsSync(targetFilePath)) {
          resolvedFiles.push(path.resolve(targetFilePath));
        }
      }

      if (resolvedFiles.length > 0) {
        console.log(`[Electron] Starting native OLE drag-out for ${resolvedFiles.length} item(s):`, resolvedFiles);
        const iconPath = path.join(__dirname, "drag-icon.png");
        const icon = nativeImage.createFromPath(iconPath);
        event.sender.startDrag({
          file: resolvedFiles[0],
          files: resolvedFiles,
          icon: icon.isEmpty() ? iconPath : icon,
        });
        console.log(`[Electron] Native OLE drag-out completed for ${resolvedFiles.length} item(s).`);
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("native-drag-finished", { count: resolvedFiles.length, files: resolvedFiles });
        }
      } else {
        console.warn(`[Electron] Drag-out aborted: no valid files found on disk.`);
      }
    } catch (err) {
      console.error("[Electron] Failed to start native drag:", err);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = fs.existsSync(path.join(__dirname, "icon.ico"))
    ? path.join(__dirname, "icon.ico")
    : path.join(__dirname, "tray-icon.ico");
  try {
    tray = new Tray(iconPath);
    tray.setToolTip("Dynamic RAM Notch (Clipboard Manager)");

    updateTrayMenu();

    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        positionWindow(180, 30);
      }
    });

    console.log("[Electron] System Tray icon registered successfully.");
  } catch (err) {
    console.error("[Electron] Failed to create Tray icon:", err);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const displays = screen.getAllDisplays();
  const currentDisplay = getActiveDisplay();

  const displayMenuItems = displays.map((d, index) => {
    const isCurrent = currentDisplay.id === d.id;
    const isLaptop = d.bounds.width === 1440;
    const label = isLaptop
      ? `Display ${index + 1}: Laptop Screen (${d.bounds.width}x${d.bounds.height})`
      : `Display ${index + 1}: External Monitor (${d.bounds.width}x${d.bounds.height})`;

    return {
      label,
      type: "radio",
      checked: isCurrent,
      click: () => {
        selectedDisplayId = d.id;
        positionWindow(180, 30);
        updateTrayMenu();
      },
    };
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Dynamic RAM Notch v0.1.0",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Center Notch on Laptop Screen",
      click: () => {
        const laptop = displays.find((d) => d.bounds.width === 1440);
        if (laptop) selectedDisplayId = laptop.id;
        if (mainWindow) {
          mainWindow.show();
          positionWindow(180, 30);
        }
        updateTrayMenu();
      },
    },
    {
      label: "Center Notch on External Monitor",
      click: () => {
        const ext = displays.find((d) => d.bounds.width === 1920);
        if (ext) selectedDisplayId = ext.id;
        if (mainWindow) {
          mainWindow.show();
          positionWindow(180, 30);
        }
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Select Display:",
      submenu: displayMenuItems,
    },
    { type: "separator" },
    {
      label: "Exit Notch",
      click: () => {
        stopDaemon();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// Single instance handler: focus window if another instance tries to launch
app.on("second-instance", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    positionWindow(180, 30);
  }
});

// When Electron is ready
app.whenReady().then(() => {
  startDaemonIfNeeded();
  createNotchWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createNotchWindow();
  });
});

app.on("will-quit", () => {
  stopDaemon();
});

app.on("window-all-closed", () => {
  stopDaemon();
  if (process.platform !== "darwin") app.quit();
});
