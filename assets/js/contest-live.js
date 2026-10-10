/* ==========================================================================
   메인 — 사진전 '지금 올라온 응모작' 실시간 띠 (index.html #contest-live)
   · 승인된 응모작 최신 12점을 사진·동영상 섞어 보여 준다. 누르면 사진전 게시판으로.
   · 실시간: Supabase Realtime 으로 응모작 표의 변경(승인·투표수)을 받아 바로 다시 그린다.
             (supabase/contest.sql 의 'Realtime 켜기' 부분이 실행돼 있어야 함)
             연결이 안 되는 환경을 위해 1분마다 한 번 더 불러온다.
   · 표가 없거나 응모작이 0점이면 칸 전체를 숨긴다.
   ========================================================================== */
(function () {
  "use strict";
  const box = document.getElementById("contest-live");                 // 이미지 띠(없을 수 있음)
  if (!box && !document.getElementById("contest-status")) return;

  const c = window.Auth && Auth.ready() ? Auth.client() : null;
  const row = document.getElementById("contest-live-row");
  const count = document.getElementById("contest-live-count");
  const SHOW = 12;
  const CAT = { photo: "사진", short: "동영상" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const pub = (p) => c.storage.from("contest").getPublicUrl(p).data.publicUrl;
  let seen = null;                 // 처음 그린 뒤 새로 들어온 작품에 'NEW' 표시

  /* ---------- 오른쪽 '응모 현황' 카드 ---------- */
  const $id = (k) => document.getElementById(k);
  function ddayText() {
    const now = new Date(Date.now() + 9 * 3600e3), today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const d = Math.round((Date.UTC(2026, 11, 30) - today) / 86400000);
    return d > 0 ? `D-${d}` : d === 0 ? "D-DAY" : "마감";
  }
  function drawStatus(all, sample) {
    if (!$id("contest-status")) return;
    const photo = all.filter((e) => e.category !== "short").length, short = all.length - photo;
    const votes = all.reduce((s, e) => s + (e.vote_count || 0), 0);
    $id("cs-total").textContent = all.length.toLocaleString("ko-KR");
    $id("cs-split").textContent = `사진 ${photo} · 동영상 ${short}`;
    $id("cs-votes").textContent = votes.toLocaleString("ko-KR");
    $id("cs-dday").textContent = ddayText();
    // TOP 5 — 실제 응모작이 없으면 예시 작품으로 (예시 표시)
    const src = all.length ? all.map((e) => ({ title: e.title, votes: e.vote_count || 0, short: e.category === "short", img: pub(e.photo_thumb) }))
                           : (window.CONTEST_SAMPLES || []).map((s) => ({ title: s.title, votes: s.votes, short: s.category === "short", img: `assets/img/gallery/${s.img}_t.webp` }));
    const top = src.sort((a, b) => b.votes - a.votes).slice(0, 5);
    const max = Math.max(1, top.length ? top[0].votes : 1);
    $id("cs-ex").textContent = all.length ? "" : "예시";
    $id("cs-bars").innerHTML = top.map((x, i) => `<li${i === 0 && x.votes ? ' class="is-top"' : ""}>
        <span class="cs__rank">${i + 1}</span>
        <span class="cs__img"><img src="${x.img}" alt="" loading="lazy">${x.short ? '<i aria-hidden="true">▶</i>' : ""}</span>
        <span class="cs__name">${x.short ? "" : ""}${esc(x.title)}</span>
        <span class="cs__track"><i style="width:${Math.max(x.votes / max * 100, x.votes ? 3 : 0)}%"></i></span>
        <span class="cs__val">${x.votes.toLocaleString("ko-KR")}</span>
      </li>`).join("") || '<li class="cs__none">첫 응모의 주인공을 기다려요</li>';
  }

  async function load() {
    if (!c) { drawSamples(); drawStatus([], true); return; }    // 서버 연결 없음 → 예시만
    const { data: all, error } = await c.from("contest_entries").select("id,category,title,nickname,photo_thumb,vote_count")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(1000);
    drawStatus(error ? [] : all || [], !all || !all.length);
    const data = (all || []).slice(0, SHOW), total = (all || []).length;
    if (!box) return;                                                   // 이미지 띠가 없으면 여기까지
    if (error || !data.length) { drawSamples(); return; }               // 표 없음·응모작 없음 → 예시 카드
    const fresh = seen ? new Set(data.filter((e) => !seen.has(e.id)).map((e) => e.id)) : new Set();
    seen = new Set(data.map((e) => e.id));
    count.textContent = total ? `${total}점` : "";
    row.innerHTML = data.map((e) => `
      <a class="cl-card${e.category === "short" ? " cl-card--short" : ""}${fresh.has(e.id) ? " is-new" : ""}"
         href="contest.html${e.category === "short" ? "#short" : ""}" title="${esc(e.title)} — 투표하러 가기">
        <span class="cl-card__img"><img src="${pub(e.photo_thumb)}" alt="" loading="lazy">
          ${e.category === "short" ? '<i class="cl-play" aria-hidden="true">▶</i>' : ""}
          <em class="cl-cat">${CAT[e.category] || ""}</em></span>
        <span class="cl-card__txt"><b>${esc(e.title)}</b><small>${esc(e.nickname)} · ♥ ${e.vote_count}</small></span>
      </a>`).join("");
    box.hidden = false;
  }

  /* 아직 승인된 응모작이 없을 때 — 예시 작품(contest-samples.js)으로 띠를 채운다 */
  function drawSamples() {
    if (!box) return;
    const ex = window.CONTEST_SAMPLES || [];
    if (!ex.length) { box.hidden = true; return; }
    count.textContent = "예시";
    row.innerHTML = ex.map((s) => `
      <a class="cl-card cl-card--sample${s.category === "short" ? " cl-card--short" : ""}" href="contest.html#enter" title="예시 작품 — 응모하러 가기">
        <span class="cl-card__img"><img src="assets/img/gallery/${s.img}_t.webp" alt="" loading="lazy">
          ${s.category === "short" ? '<i class="cl-play" aria-hidden="true">▶</i>' : ""}
          <em class="cl-cat">${CAT[s.category]}</em><em class="cl-ex">예시</em></span>
        <span class="cl-card__txt"><b>${esc(s.title)}</b><small>첫 응모의 주인공을 기다려요</small></span>
      </a>`).join("");
    box.hidden = false;
  }

  load();
  setInterval(load, 60000);                                   // 1분마다 (실시간 연결이 끊겨도)

  // 실시간 — 응모작 표에 변화가 생기면 잠깐 모았다가 한 번에 다시 그린다
  let t = null;
  if (c) try {
    c.channel("contest-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contest_entries" }, () => {
        clearTimeout(t); t = setTimeout(load, 800);
      })
      .subscribe();
  } catch (e) { /* 실시간을 못 써도 1분 새로고침으로 동작 */ }
})();
