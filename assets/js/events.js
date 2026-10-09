/* 용마미식거리 운영일 한 곳 모음 — 달력(calendar.js)과 참여 신청(join.html)이 함께 쓴다.
   일정을 바꿀 때는 이 파일만 고치면 두 화면이 같이 바뀐다.

   종류 reg = 정규행사(주황) / dh = 동행축제(보라·강조) / sp = 특별행사(진한 주황)

   window.YM_EVENTS      날짜("2026-10-16") → { kind, name, sub, sub2 }
   window.YM_EVENT_DAYS  날짜 순으로 정렬한 배열 [{ date, kind, name, sub, sub2, label }]
                         label 예) "10월 16일(금) · 정규행사"
*/
(function () {
  "use strict";

  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function key(d) {
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  var EVENTS = {};

  /* 정규행사 — 10/9(금)·10(토)부터 11/14(토)까지 매주 금·토 (맛집대축제 현수막 기준) */
  var d = new Date(2026, 9, 9), end = new Date(2026, 10, 14);
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    var w = d.getDay();                                    // 5=금, 6=토
    if (w !== 5 && w !== 6) continue;
    EVENTS[key(d)] = { kind: "reg", name: "정규행사", sub: "버스킹" };
  }

  // 10/30·31 은 중기부 동행축제 연계 — 정규행사보다 크게 치르고, 버스킹도 함께 연다
  EVENTS["2026-10-30"] = { kind: "dh", name: "동행축제", sub: "동행축제", sub2: "버스킹" };
  EVENTS["2026-10-31"] = { kind: "dh", name: "동행축제", sub: "동행축제", sub2: "버스킹" };

  /* 날짜 순 배열로도 만들어 둔다 — 신청 화면의 희망 참여일 목록이 이걸 쓴다 */
  var DAYS = Object.keys(EVENTS).sort().map(function (k) {
    var p = k.split("-");
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    var ev = EVENTS[k];
    return {
      date: k,
      kind: ev.kind,
      name: ev.name,
      sub: ev.sub,
      sub2: ev.sub2,
      label: (+p[1]) + "월 " + (+p[2]) + "일(" + WEEK[dt.getDay()] + ") · " + ev.name
    };
  });

  window.YM_EVENTS = EVENTS;
  window.YM_EVENT_DAYS = DAYS;
})();
