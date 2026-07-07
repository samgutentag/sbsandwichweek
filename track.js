// Lightweight event tracker — sends fire-and-forget beacons to a Cloudflare Worker.
// Set THEME.trackUrl to the worker URL to enable, or leave null to disable.

// Treat localhost and private LAN ranges as dev hosts, so on-device testing
// over the LAN never pollutes production analytics.
function isDevHost(h) {
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    /\.local$/.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

(function () {
  var url = typeof THEME !== "undefined" && THEME.trackUrl;
  if (!url) return;

  // Archived events send nothing: trackUrl stays set so the stats pages can
  // read historical aggregates, but window.track must never exist. Without
  // this, every visit to a wound-down map keeps POSTing beacons the Worker
  // will refuse anyway.
  if (THEME.archived) return;

  if (isDevHost(location.hostname)) return;

  window.track = function (action, label) {
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify({ action: action, label: label })], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    }
  };

  // One viewport-width sample per session from the main map — feeds the
  // "Screen Widths" breakdown for layout work. Skipped on the stats and embed
  // pages so the sample reflects real map visitors, not dashboard views.
  try {
    var onMainMap = !/\/(stats|embed)\//.test(location.pathname);
    if (onMainMap && !sessionStorage.getItem("vp-sampled")) {
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      var bucket =
        w < 400 ? "<400"
        : w < 600 ? "400-599"
        : w < 768 ? "600-767"
        : w < 1024 ? "768-1023"
        : w < 1440 ? "1024-1439"
        : "1440+";
      window.track("viewport", bucket);
      sessionStorage.setItem("vp-sampled", "1");
    }
  } catch (e) {}

  // One traffic-source sample per session from the ?src= param (e.g. links from
  // the article embed carry ?src=embed), so we can attribute where visits come
  // from without any third-party analytics.
  try {
    var src = new URLSearchParams(location.search).get("src");
    if (src && !sessionStorage.getItem("src-sampled")) {
      window.track("source", src.slice(0, 40));
      sessionStorage.setItem("src-sampled", "1");
    }
  } catch (e) {}
})();

// Cloudflare Web Analytics (RUM) beacon — powers the live-visitor counts.
// Injected only when THEME.cfAnalyticsToken is set (and never on localhost).
// Needed because the site is DNS-only on Cloudflare, so CF can't auto-inject it.
(function () {
  var token = typeof THEME !== "undefined" && THEME.cfAnalyticsToken;
  if (!token) return;
  if (isDevHost(location.hostname)) return;
  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
