const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const path = require("path");

let mainWindow = null;
let tray = null;
let selectedDisplayId = null;

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

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false, // Keep visible on taskbar so user can clearly see it's active
    resizable: false,
    hasShadow: false,
    show: false,
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

  // Dynamic window resizing for Collapsed vs Expanded notch
  ipcMain.on("set-notch-state", (event, state) => {
    if (!mainWindow) return;

    if (state === "expanded") {
      positionWindow(460, 110);
    } else {
      positionWindow(180, 30);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "tray-icon.ico");
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

    console.log("[Electron] System Tray icon registered successfully with tray-icon.ico.");
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
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// When Electron is ready
app.whenReady().then(() => {
  createNotchWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createNotchWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
