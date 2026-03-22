(() => {
if (window._yttvInjected) return;
window._yttvInjected = true;

// Connection status messages.
const msg = {
  rest: "You're back online",
  lost: "You're offline",
};

/**
 * Overrides visibility change events to allow continuous playback even when
 * the window focus is changed.
 */
const visibilityChangeOverriding = () => {
  document.addEventListener(
    "webkitvisibilitychange",
    (event) => {
      event.stopImmediatePropagation();
    },
    true,
  );

  document.addEventListener(
    "visibilitychange",
    (event) => {
      event.stopImmediatePropagation();
    },
    true,
  );
};

/**
 * Observes title tag changes to restore the original title (YouTube TV).
 */
const observeTitleChanges = () => {
  document.title = "YouTube TV";

  const obs = new MutationObserver(() => {
    if (document.title === "YouTube TV") return;
    document.title = "YouTube TV";
  });

  obs.observe(document.querySelector("title"), {
    attributes: true,
    subtree: true,
    childList: true,
  });
};

const loadConnectionWarnings = () => {
  // Connection restored.
  const rest = document.createElement("div");

  // Connection lost.
  const lost = document.createElement("div");

  // Messages
  const restP = document.createElement("p");
  restP.textContent = msg.rest;
  rest.appendChild(restP);

  const lostP = document.createElement("p");
  lostP.textContent = msg.lost;
  lost.appendChild(lostP);

  // Style element declaration.
  const styles = document.createElement("style");

  // Class declaration.
  styles.textContent = `
    .warning {
        position: absolute;
        left: 50%;
        bottom: 0px;
        width: 100%;
        transform: translate(-50%, 100%);
        transition: ease-out 0.2s transform;
        will-change: transform;
        text-align: center;
        z-index: 9999;
    }

    .warning > p {
        margin: 10px 0px;
        font-weight: 500;
    }

    .rest { background: #009D32 }
    .lost { background: red }

    .visible { transform: translate(-50%, 0%) }
    `;

  // Class assignment.
  rest.classList.add("warning", "rest");
  lost.classList.add("warning", "lost");

  // Assign an identifier.
  rest.id = "rest";
  lost.id = "lost";

  // Add the connection restored warning.
  document.body.appendChild(rest);

  // Add the connection lost warning.
  document.body.appendChild(lost);

  // Add the styles.
  document.body.appendChild(styles);
};

/**
 * Listens to connection state change events to YouTube TV server (for later versions).
 * Triggered when connection to server is lost and when it's restored.
 */
const loadConnectionEvents = () => {
  // Load electron IPC.
  window.ipc = window.require("electron").ipcRenderer;

  // Declare connection restoration warning.
  const rest = document.getElementById("rest");

  // Declare connection lost warning.
  const lost = document.getElementById("lost");

  // Load connection event.
  window.addEventListener("online", () => {
    // Remove connection lost warning.
    lost.classList.remove("visible");

    // Add visible class.
    rest.classList.add("visible");

    // Emit to renderer
    window.ipc.send("network", "online");

    // Remove visible class after 5 seconds.
    setTimeout(() => {
      rest.classList.remove("visible");
    }, 5000);
  });

  // Load connection lost event.
  window.addEventListener("offline", () => {
    // Remove visible class.
    rest.classList.remove("visible");

    // Add visible class.
    lost.classList.add("visible");

    // Emit to renderer
    window.ipc.send("network", "offline");

    // Remove visible class after 5 seconds.
    setTimeout(() => {
      lost.classList.remove("visible");
    }, 5000);
  });
};

/**
 * Monitor media playback and control system integrations (volume and power management)
 */
const setupMediaControl = () => {
  console.log("🎮 Media control system loaded");

  // Track the last user-set volume so we can restore it after disconnect
  let lastVolume = null;

  function setupMediaListener() {
    const videoPlayer = document.querySelector(".html5-video-player");
    const video = videoPlayer
      ? videoPlayer.querySelector("video")
      : document.querySelector("video");

    if (!video) {
      setTimeout(setupMediaListener, 500);
      return;
    }

    if (video._mediaListenerAttached) return;

    window.ipc.invoke("get-volume").then((currentVolume) => {
      console.log("🔊 Initial volume:", currentVolume);
      lastVolume = currentVolume;
      video.volume = currentVolume / 100;
      if (videoPlayer && videoPlayer.setVolume)
        videoPlayer.setVolume(currentVolume);
    });

    video.addEventListener("volumechange", () => {
      const volume =
        videoPlayer && videoPlayer.getVolume
          ? videoPlayer.getVolume()
          : Math.round(video.volume * 100);
      lastVolume = volume;
      window.ipc.send("volume-change", Number(volume));
    });

    video.addEventListener("play", () => {
      window.ipc.send("media-playing");
    });

    video.addEventListener("pause", () => {
      window.ipc.send("media-stopped");
    });

    video.addEventListener("ended", () => {
      window.ipc.send("media-stopped");
    });

    window.ipc.on("pause-media", () => {
      if (!video.paused) {
        video.pause();
      }
    });

    video._mediaListenerAttached = true;
  }

  // Set up the volume listener
  setupMediaListener();

  // Watch for new video elements and device disconnect toast
  function startObserver() {
    if (document.body) {
      new MutationObserver(() => {
        setupMediaListener();

        // Detect "Device disconnected" toast from YouTube TV
        const toast = document.querySelector("yt-overlay-toast-renderer");
        if (toast && toast.textContent.includes("disconnected")) {
          const videoPlayer = document.querySelector(".html5-video-player");
          const video = document.querySelector("video");
          if (video && !video.paused) {
            if (lastVolume !== null) {
              video.volume = lastVolume / 100;
              if (videoPlayer && videoPlayer.setVolume)
                videoPlayer.setVolume(lastVolume);
              window.ipc.send("volume-change", lastVolume);
            }
            video.pause();
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startObserver, 100);
    }
  }

  startObserver();
};

// Load visibility change event overrides.
visibilityChangeOverriding();

// Observe title changes.
observeTitleChanges();

// Load connection status warnings.
loadConnectionWarnings();

// Load connection change events with YouTube TV server.
loadConnectionEvents();

// Setup media control (playback monitoring and volume control)
setupMediaControl();

console.log(
  "JavaScript enhancements loaded at",
  new Date(Date.now()).toISOString(),
);
})();
