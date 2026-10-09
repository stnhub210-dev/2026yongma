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
  const box = document.getElementById("contest-live");
  if (!box) return;

  const c = window.Auth && Auth.ready() ? Auth.client() : null;
  const row = document.getElementById("contest-live-row");
  const count = document.getElementById("contest-live-count");
  const SHOW = 12;
  const CAT = { photo: "📷 사진", short: "🎬 동영상" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const pub = (p) => c.storage.from("contest").getPublicUrl(p).data.publicUrl;
  let seen = null;                 // 처음 그린 뒤 새로 들어온 작품에 'NEW' 표시

  async function load() {
    if (!c) { drawSamples(); return; }                          // 서버 연결 없음 → 예시만
    const [{ data, error }, { count: total }] = await Promise.all([
      c.from("contest_entries").select("id,category,title,nickname,photo_thumb,vote_count")
        .eq("status", "approved").order("created_at", { ascending: false }).limit(SHOW),
      c.from("contest_entries").select("id", { count: "exact", head: true }).eq("status", "approved"),
    ]);
    if (error || !data || !data.length) { drawSamples(); return; }       // 표 없음·응모작 없음 → 예시 카드
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
