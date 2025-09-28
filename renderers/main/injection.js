// Mensajes de estado.
const msgDB = {
  es: {
    rest: "Vuelves a tener conexión",
    lost: "No tienes conexión",
  },
  en: {
    rest: "You're back online",
    lost: "You're offline",
  },
};

let msg = msgDB.en;

Object.keys(msgDB).forEach((lang) => {
  if (lang === navigator.language) msg = msgDB[lang];
});

/**
 * Anula los eventos de cambio de visibilidad para que se permita continuar la reproducción aún cuando
 * se cambie el foco de la ventana.
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
 * Observa los cambios de la etiqueta título para recuperar el título original (YouTube TV).
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
  // Conexión restablecida.
  const rest = document.createElement("div");

  // Conexión perdida.
  const lost = document.createElement("div");

  // Mensajes
  rest.innerHTML = `<p>${msg.rest}</p>`;
  lost.innerHTML = `<p>${msg.lost}</p>`;

  // Declaración de del elemento de estilo.
  const styles = document.createElement("style");

  // Declaración de clases.
  styles.innerHTML = `
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

  // Asignación de clases.
  rest.classList.add("warning", "rest");
  lost.classList.add("warning", "lost");

  // Asigna un identificador.
  rest.id = "rest";
  lost.id = "lost";

  // Añade el aviso de conexión establecida.
  document.body.appendChild(rest);

  // Añade el aviso de conexión perdida.
  document.body.appendChild(lost);

  // Añade los estilos.
  document.body.appendChild(styles);
};

/**
 * Escucha eventos de cambio de estado de conexión al servidor de YouTube TV (para versiones posteriores).
 * Se dispara cuando pierde conexión al servidor y cuando se recupera.
 */
const loadConnectionEvents = () => {
  // Carga el IPC de electron.
  window.ipc = window.require("electron").ipcRenderer;

  // Declara el aviso de restauración de conexión.
  const rest = document.getElementById("rest");

  // Declara el aviso de pérdida de conexión.
  const lost = document.getElementById("lost");

  // Carga el evento de conexión.
  window.addEventListener("online", () => {
    // Elimina el aviso de conexión perdida.
    lost.classList.remove("visible");

    // Añade la clase visible.
    rest.classList.add("visible");

    // Emite al renderizador (?)
    window.ipc.send("network", "online");

    // Elimina la clase visible pasados los 5 segundos.
    setTimeout(() => {
      rest.classList.remove("visible");
    }, 5000);
  });

  // Carga el evento de pérdida de conexión.
  window.addEventListener("offline", () => {
    // Elimina la clase visible.
    rest.classList.remove("visible");

    // Añade la clase visible.
    lost.classList.add("visible");

    // Emite al renderizador (?)
    window.ipc.send("network", "offline");

    // Elimina la clase visible pasados los 5 segundos.
    setTimeout(() => {
      lost.classList.remove("visible");
    }, 5000);
  });
};

/**
 * Monitor media playback state to control power save blocking
 */
const monitorMediaPlayback = () => {
  let isPlaying = false;
  let mediaObserver = null;

  // Function to check if any video is currently playing
  const checkPlaybackState = () => {
    const videos = document.querySelectorAll("video");
    let newIsPlaying = false;

    videos.forEach((video) => {
      if (!video.paused && !video.ended && video.readyState > 2) {
        newIsPlaying = true;
      }
    });

    // Only send IPC message if state changed
    if (newIsPlaying !== isPlaying) {
      isPlaying = newIsPlaying;

      if (isPlaying) {
        window.ipc.send("media-playing");
        console.log("Media started playing - preventing sleep");
      } else {
        window.ipc.send("media-paused");
        console.log("Media paused/stopped - allowing sleep");
      }
    }
  };

  // Check periodically for playback state
  setInterval(checkPlaybackState, 1000);

  // Listen for video events more immediately
  const attachVideoListeners = () => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (!video.hasAttribute("data-power-save-listener")) {
        video.addEventListener("play", () => {
          setTimeout(checkPlaybackState, 100);
        });

        video.addEventListener("pause", () => {
          setTimeout(checkPlaybackState, 100);
        });

        video.addEventListener("ended", () => {
          setTimeout(checkPlaybackState, 100);
        });

        video.setAttribute("data-power-save-listener", "true");
      }
    });
  };

  // Attach listeners to existing videos
  attachVideoListeners();

  // Watch for new video elements being added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          if (node.tagName === "VIDEO") {
            attachVideoListeners();
          } else if (node.querySelectorAll) {
            const videos = node.querySelectorAll("video");
            if (videos.length > 0) {
              attachVideoListeners();
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check after a short delay to ensure page is loaded
  setTimeout(checkPlaybackState, 2000);
};

/**
 * Intercept volume control and redirect to system volume
 */
const interceptVolumeControl = () => {
  console.log("🔊 Volume control script loaded");

  function setupVolumeListener() {
    const videoPlayer = document.querySelector(".html5-video-player");
    const video = videoPlayer ? videoPlayer.querySelector("video") : null;

    if (!video) {
      setTimeout(setupVolumeListener, 500);
      return;
    }

    if (video._volumeListenerAttached) return;

    console.log("🎵 Attaching volume change listener");
    videoPlayer.setVolume(40);

    video.addEventListener("volumechange", () => {
      const volume = videoPlayer.getVolume();
      console.log("🔊 Volume changed:", volume);
      window.ipc.send("volume-change", Number(volume));
    });

    video._volumeListenerAttached = true;
  }

  // Set up the volume listener
  setupVolumeListener();

  // Watch for new video elements and re-apply the listener
  function startObserver() {
    if (document.body) {
      new MutationObserver(() => {
        setupVolumeListener();
      }).observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startObserver, 100);
    }
  }

  startObserver();
};

// Carga la anulación de eventos de cambios de visibilidad.
visibilityChangeOverriding();

// Observa el cambio de título.
observeTitleChanges();

// Carga los avisos de estado de conexión.
loadConnectionWarnings();

// Carga los eventos de cambio de conexión con el servidor de YouTube TV.
loadConnectionEvents();

// Monitor media playback for power save management
monitorMediaPlayback();

// Intercept volume control
interceptVolumeControl();

console.log(
  "JavaScript enhancements loaded at",
  new Date(Date.now()).toISOString(),
);
