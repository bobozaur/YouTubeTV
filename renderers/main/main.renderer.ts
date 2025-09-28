import { readFile } from "fs/promises";
import { platform } from "os";
import { cwd } from "process";
import { join } from "path";

import { exec } from "child_process";

import {
  app,
  BrowserWindow,
  nativeImage,
  globalShortcut,
  Menu,
  ipcMain,
  powerSaveBlocker,
} from "electron";
import { setVolume } from "loudness";

export class Renderer {
  /** userAgent allowed by YouTube TV. */
  private readonly userAgent: string =
    "Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754";

  /** Electron process */
  private window: BrowserWindow;

  private powerSaveManager: PowerSaveManager;

  private volumeManager: VolumeManager;

  /** YouTube TV url with path/params */
  private readonly _url: string = "https://www.youtube.com/tv?";

  /** JavaScript injection code */
  private jsic: string = "";

  /** JavaScript injection title bar styles */
  private titleBar: string = "";

  constructor() {
    // Set app menu to null.
    Menu.setApplicationMenu(null);

    app
      .on("ready", () => {
        this.createWindow();

        this.url = "__DFT__";

        this.window.webContents.on("dom-ready", () =>
          this.injectJSCode.bind(this),
        );

        this.window.on("close", () => {
          // Cleanup power save manager
          if (this.powerSaveManager) {
            this.powerSaveManager.cleanup();
          }
        });
      })
      .on("window-all-closed", () => {
        app.quit();
      });
  }

  /** Create a new renderer window. */
  private createWindow() {
    this.window = new BrowserWindow({
      width: 1230,
      height: 720,
      titleBarStyle: platform() === "darwin" ? "hiddenInset" : "default",
      fullscreen: false,
      fullscreenable: true,
      title: "YouTube TV",
      backgroundColor: "#282828",
      icon: nativeImage.createFromPath(join(cwd(), "build", "icon.png")),
      webPreferences: {
        nodeIntegration: true,
        webSecurity: true,
        contextIsolation: false,
        backgroundThrottling: false,
      },
    });

    this.powerSaveManager = new PowerSaveManager();
    this.volumeManager = new VolumeManager();
  }

  /**
   * Inject a JavaScript code into the renderer process to patch events and add some features.
   * @param script Type of script to be injected.
   * */
  private async injectJSCode(script: "all" | "patchs" | "titlebar" = "all") {
    try {
      if (this.jsic === "") {
        this.jsic = await readFile(join(__dirname, "injection.js"), {
          encoding: "utf8",
        });
      }

      if (platform() === "darwin" && this.titleBar === "") {
        this.titleBar = await readFile(join(__dirname, "titleBar.js"), {
          encoding: "utf8",
        });
      }

      if (script === "all") {
        this.window.webContents.executeJavaScript(this.jsic);
        platform() === "darwin"
          ? this.window.webContents.executeJavaScript(this.titleBar)
          : false;
      } else if (script === "patchs") {
        this.window.webContents.executeJavaScript(this.jsic);
      } else if (script === "titlebar") {
        platform() === "darwin"
          ? this.window.webContents.executeJavaScript(this.titleBar)
          : false;
      }
    } catch (error) {
      debugger;
      // throw new Error(error as unknown as any);
    }
  }

  /**
   * Load new user connection **and reload the renderer process**.
   * If value is '__DFT__', the default YouTube TV url will be loaded.
   * */
  public set url(value: string) {
    let url = value;
    if (typeof value !== "string") return;
    if (value.length < 1) return;
    if (value === "__DFT__") url = "";

    this.window
      .loadURL(this._url + url, { userAgent: this.userAgent })
      .then(() => {
        this.injectJSCode();
      })
      .catch(async () => {
        ipcMain.once("restored", () => {
          this.url = value;
        });

        this.injectJSCode("titlebar");
        const offline = await readFile(join(__dirname, "offline_banner.js"), {
          encoding: "utf8",
        });
        this.window.webContents.executeJavaScript(offline);
      });
  }

  public set urlByDial(value: string) {
    if (typeof value !== "string") return;
    if (value.length < 1) return;

    this.window.webContents
      .loadURL(this._url + value, { userAgent: this.userAgent })
      .then(() => {
        this.injectJSCode();
      })
      // This should never happen...
      .catch(async () => {
        ipcMain.once("restored", () => {
          this.urlByDial = value;
        });

        this.injectJSCode("titlebar");
        const offline = await readFile(join(__dirname, "offline_banner.js"), {
          encoding: "utf8",
        });
        this.window.webContents.executeJavaScript(offline);
      });
  }
}

class PowerSaveManager {
  private blockerId: number | null = null;
  private isBlocking: boolean = false;

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.on("media-playing", () => {
      this.preventSleep();
    });

    ipcMain.on("media-paused", () => {
      this.allowSleep();
    });
  }

  private preventSleep() {
    if (!this.isBlocking) {
      this.blockerId = powerSaveBlocker.start("prevent-display-sleep");
      this.isBlocking = true;
      console.log("Sleep prevention enabled - media is playing");
    }
  }

  private allowSleep() {
    if (this.isBlocking && this.blockerId !== null) {
      powerSaveBlocker.stop(this.blockerId);
      this.blockerId = null;
      this.isBlocking = false;
      console.log("Sleep prevention disabled - media is paused");
    }
  }

  public cleanup() {
    this.allowSleep();
  }
}

class VolumeManager {
  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.on("volume-change", (_, change) => {
      this.adjustSystemVolume(change);
    });
  }

  private async adjustSystemVolume(change: number) {
    await setVolume(change);
  }
}
