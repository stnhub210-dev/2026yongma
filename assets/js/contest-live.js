/* ==========================================================================
   메인 — 사진전 '지금 올라온 응모작' 실시간 띠 (index.html #contest-live)
   · 승인된 응모작 최신 12점을 사진·숏폼 섞어 보여 준다. 누르면 사진전 게시판으로.
   · 실시간: Supabase Realtime 으로 응모작 표의 변경(승인·투표수)을 받아 바로 다시 그린다.
             (supabase/contest.sql 의 'Realtime 켜기' 부분이 실행돼 있어야 함)
             연결이 안 되는 환경을 위해 1분마다 한 번 더 불러온다.
   · 표가 없거나 응모작이 0점이면 칸 전체를 숨긴다.
   ========================================================================== */
(function () {
  "use strict";
  const box = document.getElementById("contest-live");
  if (!box || !window.Auth || !Auth.ready()) return;

  const c = Auth.client();
  const row = document.getElementById("contest-live-row");
  const count = document.getElementById("contest-live-count");
  const SHOW = 12;
  const CAT = { photo: "📷 사진", short: "🎬 숏폼" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const pub = (p) => c.storage.from("contest").getPublicUrl(p).data.publicUrl;
  let seen = null;                 // 처음 그린 뒤 새로 들어온 작품에 'NEW' 표시

  async function load() {
    const [{ data, error }, { count: total }] = await Promise.all([
      c.from("contest_entries").select("id,category,title,nickname,photo_thumb,vote_count")
        .eq("status", "approved").order("created_at", { ascending: false }).limit(SHOW),
      c.from("contest_entries").select("id", { count: "exact", head: true }).eq("status", "approved"),
    ]);
    if (error || !data || !data.length) { box.hidden = true; return; }   // 표 없음·응모작 없음 → 숨김
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

  load();
  setInterval(load, 60000);                                   // 1분마다 (실시간 연결이 끊겨도)

  // 실시간 — 응모작 표에 변화가 생기면 잠깐 모았다가 한 번에 다시 그린다
  let t = null;
  try {
    c.channel("contest-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contest_entries" }, () => {
        clearTimeout(t); t = setTimeout(load, 800);
      })
      .subscribe();
  } catch (e) { /* 실시간을 못 써도 1분 새로고침으로 동작 */ }
})();
