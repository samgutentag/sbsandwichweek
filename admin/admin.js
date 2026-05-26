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
      })
      .catch(function () {
        authError.textContent = "Network error. Try again.";
        authError.style.display = "block";
      });
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
