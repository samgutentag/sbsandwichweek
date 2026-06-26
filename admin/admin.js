(function () {
  var authCard = document.getElementById("authCard");
  var authForm = document.getElementById("authForm");
  var authError = document.getElementById("authError");
  var tokenInput = document.getElementById("tokenInput");
  var dataView = document.getElementById("dataView");
  var tableBody = document.getElementById("tableBody");
  var totalCount = document.getElementById("totalCount");
  var pageTitle = document.getElementById("pageTitle");

  pageTitle.textContent = THEME.eventName;

  function fetchData(token) {
    if (!THEME.trackUrl) return;

    var url = THEME.trackUrl + "?admin=true&token=" + encodeURIComponent(token);

    fetch(url)
      .then(function (resp) {
        if (resp.status === 403) {
          authError.style.display = "block";
          tokenInput.value = "";
          tokenInput.focus();
          sessionStorage.removeItem("adminToken");
          authCard.style.display = "";
          dataView.style.display = "none";
          return null;
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data) return;

        sessionStorage.setItem("adminToken", token);
        authCard.style.display = "none";
        authError.style.display = "none";
        dataView.style.display = "block";

        var total = 0;
        var html = "";
        data.forEach(function (row, i) {
          total += row.count;
          html +=
            "<tr>" +
            '<td class="col-rank">' +
            (i + 1) +
            "</td>" +
            "<td>" +
            escapeHtml(row.query) +
            "</td>" +
            '<td class="col-count">' +
            row.count.toLocaleString() +
            "</td>" +
            "</tr>";
        });
        tableBody.innerHTML = html;
        totalCount.textContent = total.toLocaleString();

        fetchViewports();
      })
      .catch(function () {
        authError.textContent = "Network error. Try again.";
        authError.style.display = "block";
      });
  }

  // Screen Widths — viewport-bucket samples pulled from the public aggregate.
  function fetchViewports() {
    if (!THEME.trackUrl) return;
    var ORDER = ["<400", "400-599", "600-767", "768-1023", "1024-1439", "1440+"];
    var LABELS = {
      "<400": "≤ 399px — small phone",
      "400-599": "400–599px — phone",
      "600-767": "600–767px — large phone",
      "768-1023": "768–1023px — tablet",
      "1024-1439": "1024–1439px — laptop",
      "1440+": "1440px+ — desktop",
    };
    var MOBILE = { "<400": 1, "400-599": 1, "600-767": 1 };

    fetch(THEME.trackUrl + "?detail=true")
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (data) {
        if (!data) return;
        var counts = {};
        var total = 0;
        Object.keys(data).forEach(function (name) {
          var v = data[name] && data[name].viewport;
          if (v) {
            counts[name] = (counts[name] || 0) + v;
            total += v;
          }
        });
        if (total === 0) return;

        var keys = ORDER.filter(function (k) { return counts[k]; });
        Object.keys(counts).forEach(function (k) {
          if (ORDER.indexOf(k) === -1) keys.push(k);
        });

        var html = keys
          .map(function (k) {
            var c = counts[k];
            var share = total > 0 ? Math.round((c / total) * 100) + "%" : "0%";
            return (
              "<tr" + (MOBILE[k] ? ' class="vp-mobile"' : "") + ">" +
              "<td>" + escapeHtml(LABELS[k] || k) + (MOBILE[k] ? " 📱" : "") + "</td>" +
              '<td class="col-count">' + c.toLocaleString() + "</td>" +
              '<td class="col-count">' + share + "</td>" +
              "</tr>"
            );
          })
          .join("");

        document.getElementById("viewportBody").innerHTML = html;
        document.getElementById("viewportTotal").textContent = total.toLocaleString();
        document.getElementById("viewportTitle").style.display = "";
        document.getElementById("viewportTotalRow").style.display = "";
        document.getElementById("viewportTable").style.display = "";
        document.getElementById("viewportNote").style.display = "";
      })
      .catch(function () {});
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = tokenInput.value.trim();
    if (!token) return;
    authError.style.display = "none";
    fetchData(token);
  });

  // Auto-fetch if token in sessionStorage
  var saved = sessionStorage.getItem("adminToken");
  if (saved) {
    fetchData(saved);
  }
})();
