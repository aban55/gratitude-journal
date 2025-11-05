export function logEvent(name, params = {}) {
  if (window.gtag) window.gtag('event', name, params);
}
