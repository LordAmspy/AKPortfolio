/**
 * Avinash Kuppam Portfolio
 * ------------------------
 * Handles:
 *  - Scroll-controlled background image sequence
 *  - Preloader and Lottie animation
 *  - Scroll reveal animations
 *  - Statistic count-up
 *  - Mobile navigation
 *  - Project filtering
 *  - Deep-link/hash positioning
 *
 * No page logic is duplicated elsewhere.
 */
(() => {
  "use strict";

  const CONFIG = Object.freeze({
    frameCount: 240,
    frameDirectory: "ezgif-54a067e902738b5f-jpg",
    framePrefix: "ezgif-frame-",
    frameExtension: ".jpg",
    framePadding: 3,

    loaderTimeout: 3500,
    frameEase: 0.12,
    counterDuration: 1400,
    revealThreshold: 0.12
  });

  const dom = {
    body: document.body,
    canvas: document.getElementById("seq"),
    loader: document.getElementById("loader"),
    loaderFill: document.getElementById("loaderFill"),
    loaderPct: document.getElementById("loaderPct"),
    loaderStatus: document.getElementById("loaderStatus"),
    lottieContainer: document.getElementById("lottieContainer"),

    navbar: document.querySelector(".navbar"),
    navToggle: document.getElementById("navToggle"),
    navLinks: document.getElementById("navLinks"),

    tabs: [...document.querySelectorAll(".tab")],
    projectCards: [...document.querySelectorAll(".proj-card")],
    reveals: [
      ...document.querySelectorAll(
        ".reveal, .reveal-l, .reveal-r, .reveal-pop"
      )
    ],
    counters: [...document.querySelectorAll(".count")]
  };

  const ctx = dom.canvas?.getContext("2d");

  if (!dom.canvas || !ctx) {
    console.warn("Background canvas could not be initialized.");
    finishLoading();
    return;
  }

  const state = {
    targetFrame: 0,
    displayedFrame: 0,
    frameImages: [],
    loadedFrames: 0,
    loadingFinished: false,
    menuOpen: false,
    revealsStarted: false,
    countersStarted: false
  };

  const loaderMessages = [
    "Chunking documents…",
    "Generating embeddings…",
    "Indexing vectors in ChromaDB…",
    "Running similarity search…",
    "Orchestrating agents…",
    "Applying guardrails…",
    "Ready."
  ];

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getFrameUrl = (frameNumber) => {
    const padded = String(frameNumber).padStart(CONFIG.framePadding, "0");
    return (
      `${CONFIG.frameDirectory}/` +
      `${CONFIG.framePrefix}${padded}${CONFIG.frameExtension}`
    );
  };

  /* -----------------------------------------------------------------------
     Preloader
     ----------------------------------------------------------------------- */

  function updateLoader() {
    if (state.loadingFinished) return;

    const progress = clamp(
      state.loadedFrames / CONFIG.frameCount,
      0,
      1
    );

    if (dom.loaderFill) {
      dom.loaderFill.style.width = `${progress * 100}%`;
    }

    if (dom.loaderPct) {
      dom.loaderPct.textContent = `${Math.round(progress * 100)}%`;
    }

    if (dom.loaderStatus) {
      const index = Math.min(
        loaderMessages.length - 1,
        Math.floor(progress * loaderMessages.length)
      );

      dom.loaderStatus.textContent = loaderMessages[index];
    }
  }

  function finishLoading() {
    if (state.loadingFinished) return;

    state.loadingFinished = true;

    if (dom.loaderFill) dom.loaderFill.style.width = "100%";
    if (dom.loaderPct) dom.loaderPct.textContent = "100%";
    if (dom.loaderStatus) {
      dom.loaderStatus.textContent = loaderMessages.at(-1);
    }

    dom.body.classList.remove("is-loading");

    if (dom.loader) {
      dom.loader.classList.add("done");

      window.setTimeout(() => {
        dom.loader?.remove();
      }, 700);
    }

    updateFrameTarget();
    applyHashPosition();

    // A second pass handles late browser anchor restoration.
    window.setTimeout(applyHashPosition, 250);
    window.setTimeout(applyHashPosition, 800);

    startReveals();
    startCounters();
  }

  async function initLottie() {
    if (!dom.lottieContainer || !window.lottie) return;

    try {
      const response = await fetch("loader-animation.json", {
        cache: "force-cache"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const animationData = await response.json();

      window.lottie.loadAnimation({
        container: dom.lottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData
      });
    } catch (error) {
      // The portfolio remains fully usable without the decorative animation.
      console.warn("Lottie loader animation unavailable:", error);
    }
  }

  /* -----------------------------------------------------------------------
     Frame sequence
     ----------------------------------------------------------------------- */

  function preloadFrames() {
    state.frameImages = Array.from(
      { length: CONFIG.frameCount },
      (_, index) => {
        const frameNumber = index + 1;
        const image = new Image();

        image.decoding = "async";

        image.addEventListener("load", () => {
          state.loadedFrames += 1;

          if (frameNumber === 1) {
            drawFrame(0);
          }

          updateLoader();

          if (state.loadedFrames >= CONFIG.frameCount) {
            finishLoading();
          }
        });

        image.addEventListener("error", () => {
          // A missing frame should not leave the visitor behind the loader.
          state.loadedFrames += 1;
          updateLoader();

          if (state.loadedFrames >= CONFIG.frameCount) {
            finishLoading();
          }
        });

        image.src = getFrameUrl(frameNumber);

        return image;
      }
    );

    // Ask the browser to prioritize the first frame.
    state.frameImages[0]?.setAttribute("fetchpriority", "high");

    updateLoader();
  }

  function resizeCanvas() {
    // Keep the canvas at the source frame's native resolution, matching the
    // original site. CSS handles the viewport-sized presentation.
    const first = state.frameImages[0];
    if (!first?.naturalWidth) return;

    const width = first.naturalWidth;
    const height = first.naturalHeight;

    if (dom.canvas.width !== width || dom.canvas.height !== height) {
      dom.canvas.width = width;
      dom.canvas.height = height;
    }

    drawFrame(state.displayedFrame);
  }

  function isLoaded(image) {
    return Boolean(image?.complete && image.naturalWidth > 0);
  }

  function drawFrame(position) {
    const first = state.frameImages[0];
    if (!isLoaded(first)) return;

    const width = first.naturalWidth;
    const height = first.naturalHeight;

    if (dom.canvas.width !== width || dom.canvas.height !== height) {
      dom.canvas.width = width;
      dom.canvas.height = height;
    }

    const i0 = clamp(Math.floor(position), 0, CONFIG.frameCount - 1);
    const i1 = clamp(i0 + 1, 0, CONFIG.frameCount - 1);
    const t = position - i0;
    const current = state.frameImages[i0];

    // Hold the nearest loaded frame rather than flashing a blank canvas.
    if (!isLoaded(current)) {
      let fallback = i0;
      while (fallback > 0 && !isLoaded(state.frameImages[fallback])) fallback -= 1;
      if (isLoaded(state.frameImages[fallback])) {
        ctx.globalAlpha = 1;
        ctx.drawImage(state.frameImages[fallback], 0, 0);
      }
      return;
    }

    /*
     * Never clear the canvas during a scroll transition. Clearing first can
     * expose a transparent frame for a paint cycle, which looks like a blink
     * while the browser is scrolling. Every source frame covers the complete
     * canvas, so replacing the previous pixels directly is safe.
     */
    const next = state.frameImages[i1];

    if (i1 !== i0 && isLoaded(next)) {
      // Crossfade only between frames that are both ready.
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(current, 0, 0);
      ctx.globalAlpha = t;
      ctx.drawImage(next, 0, 0);
    } else {
      // If the next frame is not ready, keep a fully opaque valid frame.
      ctx.globalAlpha = 1;
      ctx.drawImage(current, 0, 0);
    }

    ctx.globalAlpha = 1;
  }

  function animationLoop() {
    const delta = state.targetFrame - state.displayedFrame;

    if (Math.abs(delta) < 0.0005) {
      state.displayedFrame = state.targetFrame;
    } else if (prefersReducedMotion()) {
      state.displayedFrame = state.targetFrame;
    } else {
      state.displayedFrame += delta * CONFIG.frameEase;
    }

    drawFrame(state.displayedFrame);
    requestAnimationFrame(animationLoop);
  }

  function updateFrameTarget() {
    const scrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight;

    const progress =
      scrollableHeight > 0
        ? clamp(window.scrollY / scrollableHeight, 0, 1)
        : 0;

    state.targetFrame =
      progress * (CONFIG.frameCount - 1);
  }

  /* -----------------------------------------------------------------------
     Deep links
     ----------------------------------------------------------------------- */

  function applyHashPosition() {
    if (!location.hash || location.hash === "#top") return;

    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);

    if (!target) return;

    const scrollMargin =
      parseFloat(getComputedStyle(target).scrollMarginTop) || 0;

    window.scrollTo({
      top:
        target.getBoundingClientRect().top +
        window.scrollY -
        scrollMargin,
      behavior: "auto"
    });
  }

  /* -----------------------------------------------------------------------
     Scroll reveals
     ----------------------------------------------------------------------- */

  function startReveals() {
    if (state.revealsStarted) return;
    state.revealsStarted = true;

    if (!("IntersectionObserver" in window)) {
      dom.reveals.forEach((element) => {
        element.classList.add("in");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("in");
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: CONFIG.revealThreshold,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    dom.reveals.forEach((element) => observer.observe(element));
  }

  /* -----------------------------------------------------------------------
     Count-up statistics
     ----------------------------------------------------------------------- */

  function animateCounter(element) {
    const target = Number.parseInt(
      element.dataset.target,
      10
    );

    if (!Number.isFinite(target)) return;

    const start = performance.now();

    function tick(now) {
      const progress = clamp(
        (now - start) / CONFIG.counterDuration,
        0,
        1
      );

      const eased = 1 - Math.pow(1 - progress, 3);

      element.textContent = String(
        Math.round(eased * target)
      );

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function startCounters() {
    if (state.countersStarted) return;
    state.countersStarted = true;

    if (!("IntersectionObserver" in window)) {
      dom.counters.forEach((element) => {
        element.textContent = element.dataset.target;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          animateCounter(entry.target);
          currentObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    dom.counters.forEach((element) => observer.observe(element));
  }

  /* -----------------------------------------------------------------------
     Mobile navigation
     ----------------------------------------------------------------------- */

  function setMenu(open) {
    if (!dom.navbar || !dom.navToggle) return;

    state.menuOpen = open;
    dom.navbar.classList.toggle("nav-open", open);

    dom.navToggle.setAttribute(
      "aria-expanded",
      String(open)
    );

    dom.navToggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation"
    );
  }

  function initNavigation() {
    if (!dom.navToggle) return;

    dom.navToggle.addEventListener("click", () => {
      setMenu(!state.menuOpen);
    });

    dom.navLinks?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenu(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) {
        setMenu(false);
      }
    });
  }

  /* -----------------------------------------------------------------------
     Project filters
     ----------------------------------------------------------------------- */

  function initProjectFilters() {
    if (!dom.tabs.length || !dom.projectCards.length) return;

    dom.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const filter = tab.dataset.filter || "all";

        dom.tabs.forEach((item) => {
          const isActive = item === tab;

          item.classList.toggle("active", isActive);
          item.setAttribute(
            "aria-selected",
            String(isActive)
          );
        });

        let visibleIndex = 0;

        dom.projectCards.forEach((card) => {
          const tags = (card.dataset.tags || "")
            .split(/\s+/)
            .filter(Boolean);

          const shouldShow =
            filter === "all" || tags.includes(filter);

          if (shouldShow) {
            card.classList.remove("hide");
            card.style.transitionDelay =
              `${visibleIndex * 70}ms`;

            visibleIndex += 1;

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                card.classList.remove("out");
              });
            });

            return;
          }

          card.style.transitionDelay = "0ms";
          card.classList.add("out");

          window.setTimeout(() => {
            if (card.classList.contains("out")) {
              card.classList.add("hide");
            }
          }, 300);
        });
      });
    });
  }

  /* -----------------------------------------------------------------------
     Bootstrap
     ----------------------------------------------------------------------- */

  function init() {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    initNavigation();
    initProjectFilters();

    window.addEventListener(
      "scroll",
      updateFrameTarget,
      { passive: true }
    );

    window.addEventListener("resize", resizeCanvas);

    window.addEventListener("load", () => {
      updateFrameTarget();
      resizeCanvas();
    });

    resizeCanvas();
    updateFrameTarget();
    animationLoop();

    initLottie();
    preloadFrames();

    // Failsafe: never leave a visitor trapped behind the loader.
    window.setTimeout(finishLoading, CONFIG.loaderTimeout);
  }

  init();
})();
