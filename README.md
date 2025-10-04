<div align="center">
<img src="./build/icon.png" width=90px>

# **YouTube TV**

[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/total.svg?color=FF0000&label=Total%20downloads)](https://github.com/marcosrg9/YouTubeTV/releases/)
[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/v2.5.0/total.svg?color=blue&label=2.5.0%20Downloads)](https://github.com/marcosrg9/YouTubeTV/releases/tag/v2.5.0)

Simple YouTube TV Client for Linux desktop based on [electron](https://www.electronjs.org/). You can connect a compatible device such as a phone or computer with Google Chrome and send videos to the app for viewing, just like on ChromeCast or smart TVs with YouTube.

<img src="./readme/demo_player.png" width="600px">

</div><br>

It implements a [DIAL](https://en.wikipedia.org/wiki/Discovery_and_Launch) server (based in [SSDP](https://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol)) to allow connection from devices that use this same protocol (limited to YouTube in this application).

Use the userAgent allowed by YouTube TV:

```
Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754
```

You can use `npm start` or `npx electron .` to start the application.
If you already have electron installed globally, you can start the app with `electron .`

Tested on Linux x64 and ARM64 platforms.

## ⚡️ Last changes [2.5.0]

### **2.5.0**

- Converted all Spanish comments to English for better maintainability
- Removed all Mac and Windows specific code, assets, and build configurations
- Optimized media control system by combining playback monitoring and volume control
- Added system volume control and idle inhibition
- Linux-only build with simplified configuration
- Removed settings control
- Fix release workflow
- Added system tray icon to allow hiding the app
- Starts hidden to tray by default

## ⚡️ Previous changes [2.4.0/2.4.1]

### **2.4.1**

- Fixed bug where the YouTube TV process would not close completely.
- Improved Linux-specific optimizations.

### **2.4.0**

- YouTube TV persistently stores parameters of the main window state, such as position, size, full screen and cursor visibility.
