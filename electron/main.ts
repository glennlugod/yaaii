import { BrowserWindow, app } from "electron";
import { dirname, join } from "path";

import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null;
let webServer: Worker | null = null;

const startWebServer = () => {
  const serverPath = join(__dirname, "webServer.js");

  webServer = new Worker(serverPath);

  webServer.on("message", (message) => {
    console.info("Received message from web server:", message);
  });

  webServer.on("error", (error) => {
    console.error("Web server error:", error);
  })

  webServer.on("exit", (code) => {
    console.info(`Web server exited with code ${code}`);
    webServer = null;
  })
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL("http://localhost:1941/index.html");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  startWebServer();
  
  setTimeout(createWindow, 1000);

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

// Kill the server and terminate workers on quit
app.on('quit', () => {
  if (webServer) {
    webServer.terminate();
  }
});
