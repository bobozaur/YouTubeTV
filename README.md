<div align="center">
<img src="./build/icon.png" width=90px>

# **YouTube TV**

[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/total.svg?color=FF0000&label=Total%20downloads)](https://github.com/marcosrg9/YouTubeTV/releases/)
[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/v2.6.0/total.svg?color=blue&label=2.6.0%20Downloads)](https://github.com/marcosrg9/YouTubeTV/releases/tag/v2.6.0)

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

## Building Linux packages

Use Node.js 22 LTS or newer and install the locked dependencies with `npm ci`.
On Fedora, install the RPM packaging tool first:

```sh
sudo dnf install rpm-build
npm ci
npm run build:rpm
```

`build:rpm` builds an RPM for the host architecture without publishing it. To
select another supported architecture, use `npm run build:rpm -- --x64` or
`npm run build:rpm -- --arm64`. Packages are written to `YTV_Builds/`.

`npm run build:linux -- --publish never` builds both DEB and RPM packages for x64
and ARM64. On Debian/Ubuntu, RPM builds require the `rpm` package. The tag release
workflow also builds both formats.

Install a locally built Fedora RPM with:

```sh
sudo dnf install ./YTV_Builds/youtube-tv-2.6.0.x86_64.rpm
```

Use the `aarch64` RPM on ARM64 systems. DNF resolves the declared Electron runtime
libraries and `alsa-utils`, which supplies `amixer` for system volume control.
The package includes the desktop launcher and application icons. A graphical
session with a system tray and working audio is required; the app starts hidden
in the tray.

## ⚡️ Last changes [2.6.0]

### **2.6.0**

- Updated Electron to v41
- App now shows fullscreen when media plays and hides to tray when paused
- Detects device disconnect via YouTube TV toast and pauses media automatically
- Player volume now syncs from system volume on startup
- Volume is preserved on device disconnect (prevents volume spike to 100%)
- Replaced systemd-inhibit/wtype with Electron's built-in powerSaveBlocker
- Fixed Trusted Types CSP violation with YouTube's updated security policy
- Fixed injection script running twice on page load

## ⚡️ Previous changes [2.5.0]

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
