/* 포남용마거리 행사일정 달력 — 10·11·12월 세 장을 그린다.
   일정(EVENTS)은 assets/js/events.js 한 곳에만 두고 여기서는 가져다 쓴다.
   달력과 참여 신청 화면이 서로 다른 날짜를 보여 주는 일이 없게 하기 위함이다.
   종류 reg = 정규행사(주황) / dh = 동행축제(보라·강조) / sp = 특별행사(진한 주황). */
(function () {
  "use strict";

  var MONTHS = [
    { y: 2026, m: 10 },
    { y: 2026, m: 11 },
    { y: 2026, m: 12 }
  ];

  var EVENTS = window.YM_EVENTS || {};

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
