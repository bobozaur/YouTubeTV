import { readFile } from "fs/promises";
import { platform } from "os";
import { cwd } from "process";
import { join } from "path";
import { Settings } from "../settings/settings.renderer";

import {
  app,
  BrowserWindow,
  nativeImage,
  globalShortcut,
  Menu,
  ipcMain,
  powerSaveBlocker,
} from "electron";

export interface resolution {
  /** Screen width */
  width: number;
  /** Screen height */
  height: number;
}

interface windowParams {
  bounds: Electron.Rectangle;
}

export class Renderer {
  /** userAgent allowed by YouTube TV. */
  private readonly userAgent: string =
    "Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754";

  /** Electron process */
  private window: BrowserWindow;
  
  private powerSaveManager: PowerSaveManager;

  /** Settings window */
  private settings: Settings | null;

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

        this.listenWindowMoveEvents();

        this.url = "__DFT__";

        this.window.webContents.on("dom-ready", () =>
          this.injectJSCode.bind(this),
        );

        this.setAccelerators();

        this.window.on("close", () => {
          if (this.settings) {
            this.settings.destroy();
            this.settings = null;
          }
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

    process.nextTick(() => this.loadSettings());
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

  public setMaxRes(params: { width: number; height: number; reload: boolean }) {
    const { width, height, reload } = params;

    this.localStorageQuery("set", "maxRes", { width, height });

    if (reload) {
      this.setResEmulator(width, height);
      this.window.webContents.reload();
    } else this.updateWindowParams();
  }

  /** Emulate a screen with assigned parameters */
  private setResEmulator(emuWidth: number = 3840, emuHeight: number = 2160) {
    // Delete all listeners.
    this.window.removeAllListeners("resize");

    // Performs an initial calculation.
    this.calcEmulatedDisplay(emuWidth, emuHeight);

    // Add a listener to the window to recalculate the emulator.
    this.window.on("resize", () => {
      this.calcEmulatedDisplay(emuWidth, emuHeight);
      this.updateWindowParams();
    });
  }

  private calcEmulatedDisplay(emuWidth: number, emuHeight: number) {
    // Get the current window size.
    const [width, height] = this.window.getSize();

    this.window.webContents.disableDeviceEmulation();

    this.window.webContents.enableDeviceEmulation({
      screenSize: { width: emuWidth, height: emuHeight },
      viewSize: { width: width / emuWidth, height: height / emuHeight },
      scale: width / emuWidth,
      screenPosition: "mobile",
      viewPosition: { x: 0.5, y: 0.5 },
      deviceScaleFactor: 0,
    });
  }

  /**
   * Listen keyboard shortcuts to perform some actions.
   */
  private setAccelerators() {
    globalShortcut.register("ctrl+s", () => {
      if (this.settings) {
        this.settings.destroy();
        this.settings = null;
      } else {
        this.settings = new Settings();
      }
    });


    globalShortcut.register("ctrl+d", () => {
      this.window.webContents.toggleDevTools();
    });
  }

  /**
   * Performs a query to the local storage of the renderer process.
   * @param type Query type.
   * @param key Key of the object to be stored in the localStorage.
   * @param value Value to be set for the given key.
   */
  public async localStorageQuery(
    type: "set",
    key: string,
    value: any,
  ): Promise<any>;
  public async localStorageQuery(type: "delete", key: any): Promise<any>;
  public async localStorageQuery(type: "get", key: any): Promise<any>;
  public async localStorageQuery(type: "clear"): Promise<any>;
  public async localStorageQuery(type: "raw", data: string): Promise<any>;
  public async localStorageQuery(
    type: "get" | "set" | "delete" | "clear" | "raw",
    key?: string,
    value?: any,
    data?: string,
  ): Promise<any> {
    if (
      type === "get" ||
      type === "set" ||
      type === "delete" ||
      type === "clear" ||
      type === "raw"
    ) {
      let query = "localStorage.";

      if (type === "get") query += `getItem('${key}')`;
      else if (type === "set") {
        if (typeof value === "object") value = `'${JSON.stringify(value)}'`;
        query += `setItem('${key}', ${value})`;
      } else if (type === "delete") query += `removeItem('${key}')`;
      else if (type === "clear") query += "clear()";
      else if (type === "raw") query = data as string;

      const unresolvedQuery = this.window.webContents.executeJavaScript(query);

      if (type === "get") {
        try {
          const resolver = await unresolvedQuery;
          const parsed = JSON.parse(resolver);
          return Promise.resolve(parsed);
        } catch (error) {
          return unresolvedQuery;
        }
      } else return unresolvedQuery;
    } else return Promise.reject("unknown query type");
  }

  private listenWindowMoveEvents() {
    this.window.on("moved", () => {
      this.updateWindowParams();
    });
  }

  private getWindowParams() {
    const bounds = this.window.getBounds();

    return { bounds } as windowParams;
  }

  private updateWindowParams() {
    const params = this.getWindowParams();
    this.localStorageQuery("set", "windowParams", params);
  }

  private loadSettings() {
    this.localStorageQuery("get", "windowParams").then((data: windowParams) => {
      this.window.setBounds(data.bounds);

      this.window.on("resized", () => {
        this.updateWindowParams();
      });
    });

    this.localStorageQuery("get", "maxRes")
      .then((data: resolution) => {
        // If the usen has not set a resolution, set the default one.
        if (!data) this.setResEmulator();
        else {
          if (data.width && data.height)
            this.setResEmulator(data.width, data.height);
          else this.setResEmulator();
        }
      })
      .catch((err) => {
        // If the data is invalid or not available, set the default resolution.
        this.setResEmulator(3840, 2160);
      });
  }

  /**
   * Load new user connection **and reload the renderer process**.\
   * If value is '\_\_DFT\_\_', the default YouTube TV url will be loaded.
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