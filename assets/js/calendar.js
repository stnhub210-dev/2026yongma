/* 포남용마거리 행사일정 달력 — 10·11·12월 세 장을 그린다.
   일정을 바꾸려면 아래 EVENTS 만 고치면 된다(날짜 → 행사 이름·종류).
   종류 reg = 정규행사(주황) / dh = 동행축제(보라·강조) / sp = 특별행사(진한 주황). */
(function () {
  "use strict";

  var MONTHS = [
    { y: 2026, m: 10 },
    { y: 2026, m: 11 },
    { y: 2026, m: 12 }
  ];

  /* 정규행사 — 10/16(금)·17(토)부터 11/28(토)까지 매주 금·토 */
  var EVENTS = {};
  (function () {
    var d = new Date(2026, 9, 16), end = new Date(2026, 10, 28);
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      var w = d.getDay();                                  // 5=금, 6=토
      if (w !== 5 && w !== 6) continue;
      EVENTS[key(d)] = { kind: "reg", name: "정규행사", sub: "버스킹" };
    }
    // 10/30·31 은 중기부 동행축제 연계 — 정규행사보다 크게 치르고, 버스킹도 함께 연다
    EVENTS["2026-10-30"] = { kind: "dh", name: "동행축제", sub: "동행축제", sub2: "버스킹" };
    EVENTS["2026-10-31"] = { kind: "dh", name: "동행축제", sub: "동행축제", sub2: "버스킹" };
    EVENTS["2026-12-25"] = { kind: "sp", name: "특별행사", sub: "크리스마스" };
  })();

  function key(d) {
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }
  var esc = function (s) { return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function month(y, m) {
    var first = new Date(y, m - 1, 1);
    var pad = first.getDay();                              // 1일 앞의 빈 칸 수
    var last = new Date(y, m, 0).getDate();
    var count = 0;

    var cells = "";
    for (var i = 0; i < pad; i++) cells += '<span class="cal-d cal-d--pad"></span>';
    for (var day = 1; day <= last; day++) {
      var d = new Date(y, m - 1, day), ev = EVENTS[key(d)];
      var w = d.getDay();
      var cls = "cal-d";
      if (w === 0) cls += " sun";
      if (w === 6) cls += " sat";
      if (ev) { cls += " on on--" + ev.kind; count++; }
      var tip = ev ? ev.name + (ev.sub2 ? " · " + ev.sub2 + " 동시 진행" : " · " + ev.sub) : "";
      cells += '<span class="' + cls + '"' + (ev ? ' title="' + esc(tip) + '"' : "") + ">" +
        '<b>' + day + "</b>" +
        (ev ? '<em>' + esc(ev.sub) + "</em>" : "") +
        (ev && ev.sub2 ? '<em class="sub2">+' + esc(ev.sub2) + "</em>" : "") + "</span>";
    }

    return '<article class="cal-card">' +
      '<header class="cal-head"><h3>' + m + '월</h3>' +
        '<span class="cal-count">' + (count ? "행사 " + count + "일" : "행사 없음") + "</span></header>" +
      '<div class="cal-week">' + WEEK.map(function (w, i) {
        return '<span class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + w + "</span>";
      }).join("") + "</div>" +
      '<div class="cal-grid">' + cells + "</div>" +
      "</article>";
  }

  var host = document.getElementById("cal-months");
  if (host) host.innerHTML = MONTHS.map(function (x) { return month(x.y, x.m); }).join("");
})();
