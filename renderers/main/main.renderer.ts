import { readFile } from "fs/promises";
import { cwd } from "process";
import { join } from "path";
import { setVolume } from "loudness";
import { spawn, ChildProcess } from "child_process";

import {
  app,
  BrowserWindow,
  nativeImage,
  globalShortcut,
  Menu,
  ipcMain,
  powerSaveBlocker,
} from "electron";

export class Renderer {
  /** userAgent allowed by YouTube TV. */
  private readonly userAgent: string =
    "Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754";

  /** Electron process */
  private window: BrowserWindow;

  private sleepInhibitor: ChildProcess | null = null;

  /** YouTube TV url with path/params */
  private readonly _url: string = "https://www.youtube.com/tv?";

  /** JavaScript injection code */
  private jsic: string = "";

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
          this.allowSleep();
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
      titleBarStyle: "default",
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

    ipcMain.on("volume-change", (_, change) => {
      setVolume(change);
    });

    ipcMain.on("media-playing", () => {
      this.preventSleep();
    });

    ipcMain.on("media-stopped", () => {
      this.allowSleep();
    });
  }

  private preventSleep() {
    if (this.sleepInhibitor) return;

    const wtype = spawn("wtype", ["-k", "F24"]);
    wtype.on("error", (err) => {
      console.error("Failed to execute wtype command:", err);
    });

    this.sleepInhibitor = spawn("systemd-inhibit", [
      "--what=idle",
      "--why=YouTube TV playing",
      "sleep",
      "infinity",
    ]);

    this.sleepInhibitor.on("error", (err) => {
      console.error("Failed to start sleep inhibitor:", err);
    });

    this.sleepInhibitor.on("exit", (code, signal) => {
      console.log(
        `Sleep inhibitor process exited with code ${code} and signal ${signal}`,
      );
      this.sleepInhibitor = null;
    });

    console.log("Sleep prevention enabled - media is playing");
  }

  private allowSleep() {
    if (this.sleepInhibitor) {
      this.sleepInhibitor.kill();
      this.sleepInhibitor = null;
      console.log("Sleep prevention disabled - media is paused");
    }
  }

  /**
   * Inject a JavaScript code into the renderer process to patch events and add some features.
   * */
  private async injectJSCode() {
    try {
      if (this.jsic === "") {
        this.jsic = await readFile(join(__dirname, "injection.js"), {
          encoding: "utf8",
        });
      }

      this.window.webContents.executeJavaScript(this.jsic);
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

        const offline = await readFile(join(__dirname, "offline_banner.js"), {
          encoding: "utf8",
        });
        this.window.webContents.executeJavaScript(offline);
      });
  }
}
