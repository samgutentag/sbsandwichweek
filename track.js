// Lightweight event tracker — sends fire-and-forget beacons to a Cloudflare Worker.
// Set THEME.trackUrl to the worker URL to enable, or leave null to disable.
(function () {
  var url = typeof THEME !== "undefined" && THEME.trackUrl;
  if (!url) return;

  // Skip tracking on localhost / local dev
  var h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return;

  window.track = function (action, label) {
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify({ action: action, label: label })], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    }
  };
})();

// Cloudflare Web Analytics (RUM) beacon — powers the live-visitor counts.
// Injected only when THEME.cfAnalyticsToken is set (and never on localhost).
// Needed because the site is DNS-only on Cloudflare, so CF can't auto-inject it.
(function () {
  var token = typeof THEME !== "undefined" && THEME.cfAnalyticsToken;
  if (!token) return;
  var h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return;
  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
