const DEFAULT_SLOW_DELAY = 1400;

/**
 * Coordinates article loading UI without allowing an older request to win a
 * race against a newer retry. Pages keep the request itself here so this
 * utility remains independent of the API client and Markdown renderer.
 */
export function createArticleLoadController(root, content, options = {}) {
  const slowDelay = Number.isFinite(options.slowDelay)
    ? Math.max(0, options.slowDelay)
    : DEFAULT_SLOW_DELAY;
  const states = root
    ? Array.from(root.querySelectorAll("[data-article-load]"))
    : [];
  const initialCopy = root?.querySelector('[data-article-load-copy="initial"]');
  const slowCopy = root?.querySelector('[data-article-load-copy="slow"]');
  let requestSerial = 0;
  let slowTimer;
  let disposed = false;

  const clearSlowTimer = () => {
    if (slowTimer !== undefined) {
      window.clearTimeout(slowTimer);
      slowTimer = undefined;
    }
  };

  const setBusy = (busy) => {
    if (!content) return;
    content.hidden = busy;
    content.setAttribute("aria-busy", String(busy));
  };

  const showState = (state) => {
    // Keep focus inside this controller's managed region only when it already
    // belongs to that region. In particular, a retry click leaves focus on
    // the button until its click handler returns. We must hand focus to the
    // next state before setting aria-hidden on the old state, otherwise the
    // browser/a11y tree briefly contains a focused aria-hidden descendant.
    const activeElement = typeof document !== "undefined" ? document.activeElement : null;
    const focusIsManaged = Boolean(activeElement && (
      states.some((element) => element.contains?.(activeElement))
      || content?.contains?.(activeElement)
    ));
    const nextFocus = state === "ready"
      ? content
      : states.find((element) => element.dataset.articleLoad === state);
    let focusHandoffAttempted = false;

    // Make the handoff target focusable/visible first. This ordering matters:
    // focusing after the old state is aria-hidden is already too late for
    // browser accessibility checks.
    if (focusIsManaged && nextFocus && nextFocus !== activeElement) {
      focusHandoffAttempted = true;
      if (state === "ready") {
        if (content) {
          content.hidden = false;
          content.setAttribute("aria-busy", "false");
        }
      } else {
        if (root) root.hidden = false;
        nextFocus.hidden = false;
        nextFocus.setAttribute("aria-hidden", "false");
      }
      try {
        nextFocus.focus({ preventScroll: true });
      } catch (_) {
        try { nextFocus.focus(); } catch (_) { /* leave focus for the guarded blur below */ }
      }
    }

    // If a browser refused the handoff (for example while a node is being
    // detached), still remove focus from the old state before hiding it. The
    // old element is checked by identity so an unrelated control can never be
    // blurred by this controller.
    if (
      focusHandoffAttempted
      && typeof document !== "undefined"
      && document.activeElement === activeElement
      && typeof activeElement?.blur === "function"
    ) {
      activeElement.blur();
    }

    states.forEach((element) => {
      const active = element.dataset.articleLoad === state;
      element.hidden = !active;
      element.setAttribute("aria-hidden", String(!active));
    });
    const layout = root?.closest?.(".article-layout");
    layout?.classList?.toggle(
      "article-layout-error",
      state === "error" || state === "not-found",
    );
    if (root) {
      root.hidden = state === "ready";
      root.dataset.articleLoadCurrent = state;
    }
    // Keep the empty/stale content panel hidden for error and not-found
    // states. Only a ready article should expose the content container.
    setBusy(state !== "ready");

    // A browser can reject focus on a custom/partially mounted element. Keep
    // the fallback local and never steal focus from unrelated page controls.
    if (
      focusIsManaged
      && nextFocus
      && typeof document !== "undefined"
      && document.activeElement !== nextFocus
      && typeof nextFocus.focus === "function"
    ) {
      try {
        nextFocus.focus({ preventScroll: true });
      } catch (_) {
        try { nextFocus.focus(); } catch (_) { /* optional focus only */ }
      }
    }
  };

  const showSlowCopy = () => {
    if (!root || root.dataset.articleLoadCurrent !== "loading") return;
    if (initialCopy) initialCopy.hidden = true;
    if (slowCopy) slowCopy.hidden = false;
  };

  const begin = () => {
    requestSerial += 1;
    const token = requestSerial;
    disposed = false;
    clearSlowTimer();
    if (initialCopy) initialCopy.hidden = false;
    if (slowCopy) slowCopy.hidden = true;
    showState("loading");

    // Keep the reduced-motion preference in the controller as well as the
    // component CSS, so non-CSS consumers can make the same accessibility
    // decision without inventing a second state machine.
    const reduceMotion = typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof window !== "undefined") {
      slowTimer = window.setTimeout(() => {
        if (!reduceMotion || token === requestSerial) showSlowCopy();
      }, slowDelay);
    }
    return token;
  };

  const isCurrent = (token) => !disposed && token === requestSerial;

  const finish = (token, state) => {
    if (!isCurrent(token)) return false;
    clearSlowTimer();
    showState(state);
    return true;
  };

  return {
    begin,
    isCurrent,
    complete: (token) => finish(token, "ready"),
    fail: (token) => finish(token, "error"),
    notFound: (token) => finish(token, "not-found"),
    dispose() {
      clearSlowTimer();
      disposed = true;
      requestSerial += 1;
    },
  };
}

export function isArticleNotFoundError(error) {
  const status = error?.status ?? error?.response?.status ?? error?.code;
  if (Number(status) === 404) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("blog not found")
    || message.includes("article not found")
    || message.includes("not found")
    || message.includes("404");
}
