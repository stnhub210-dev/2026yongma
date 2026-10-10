/* 메인 맨 아래 '현장 사진' — 갤러리 전체(기록사진 + 수행사·방문객이 올린 사진)를 최신순으로, 아래 페이지 번호로 넘겨 본다.
   기록사진: assets/js/gallery-data.js / 올린 사진: Supabase gallery_uploads (없으면 기록사진만) */
(function () {
  "use strict";
  const grid = document.getElementById("hg-grid"), pager = document.getElementById("hg-pager");
  if (!grid || !pager) return;
  const PER = () => (matchMedia("(max-width: 640px)").matches ? 9 : 12);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const G = window.GALLERY || { photos: [] };
  let all = G.photos.map((p) => ({ date: p.date, time: p.time || "", cap: p.caption || "",
    thumb: `assets/img/gallery/${p.id}_t.webp`, big: `assets/img/gallery/${p.id}.webp`, tag: "" }));
  let page = 1, mode = "field";            // field = 현장(기록·수행사) / visitor = 방문객이 올린 사진
  const shown = () => all.filter((p) => (mode === "visitor") === !!p.visitor);

  function sort() { all.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); }

  function draw() {
    const items = shown(), per = PER(), pages = Math.max(1, Math.ceil(items.length / per));
    page = Math.min(Math.max(1, page), pages);
    const list = items.slice((page - 1) * per, page * per);
    const md = (d) => { const [, m, dd] = d.split("-").map(Number); return `${m}. ${dd}.`; };
    grid.innerHTML = list.map((p, i) => `
      <button type="button" class="hg-item" data-i="${(page - 1) * per + i}" aria-label="${esc(p.cap || "현장 사진")} 크게 보기">
        <img src="${p.thumb}" alt="${esc(p.cap)}" loading="lazy">
        <span class="hg-cap"><b>${md(p.date)}</b>${esc(p.cap)}</span>
      </button>`).join("");
    document.getElementById("hg-count").textContent = `${items.length.toLocaleString("ko-KR")}장`;
    document.getElementById("hg-title").firstChild.textContent = mode === "visitor" ? "방문객이 올린 사진 " : "용마미식거리 현장 사진 ";
    if (!items.length) grid.innerHTML = `<p class="muted" style="grid-column:1/-1">아직 올라온 사진이 없어요. 「사진 올리기」로 첫 사진을 올려 주세요.</p>`;
    // 페이지 번호 — 많으면 앞뒤 2개씩만
    const btn = (n, label, cur, dis) => `<button type="button" data-p="${n}"${cur ? ' aria-current="page" class="is-on"' : ""}${dis ? " disabled" : ""}>${label}</button>`;
    let h = btn(page - 1, "‹ 이전", false, page === 1);
    for (let n = 1; n <= pages; n++) {
      if (n === 1 || n === pages || Math.abs(n - page) <= 2) h += btn(n, n, n === page);
      else if (Math.abs(n - page) === 3) h += `<span class="hg-dots">…</span>`;
    }
    pager.innerHTML = h + btn(page + 1, "다음 ›", false, page === pages);
  }

  pager.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]"); if (!b || b.disabled) return;
    page = +b.dataset.p; draw();
    document.getElementById("home-gallery").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // 크게 보기
  const lb = document.getElementById("hg-lb"), img = document.getElementById("hg-lb-img"), meta = document.getElementById("hg-lb-meta");
  let cur = 0;
  const show = (i) => { const L = shown(); cur = (i + L.length) % L.length; const p = L[cur];
    img.src = p.big; img.alt = p.cap; meta.textContent = `${p.date.replace(/-/g, ". ")} ${p.time} · ${p.cap || "현장 사진"} · ${cur + 1} / ${L.length}`; };
  grid.addEventListener("click", (e) => { const it = e.target.closest(".hg-item"); if (!it) return; show(+it.dataset.i); lb.showModal(); });
  document.getElementById("hg-lb-close").onclick = () => lb.close();
  document.getElementById("hg-lb-prev").onclick = () => show(cur - 1);
  document.getElementById("hg-lb-next").onclick = () => show(cur + 1);
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });

  // 띠의 탭 — 현장 사진 / 방문객 사진
  document.querySelectorAll("[data-hg]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.hg; page = 1;
    document.querySelectorAll("[data-hg]").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-selected", x === b); });
    draw();
  }));

  sort(); draw();

  // 홈페이지에서 올린 사진(수행사·방문객) 더하기
  if (window.Auth && Auth.ready()) {
    const c = Auth.client();
    c.from("gallery_uploads").select("path,thumb_path,caption,uploader,taken_on,taken_at,kind").limit(2000).then(({ data, error }) => {
      if (error || !data) return;
      const pub = (p) => c.storage.from("gallery").getPublicUrl(p).data.publicUrl;
      all = all.concat(data.filter((r) => r.taken_on).map((r) => ({ date: r.taken_on, time: r.taken_at || "",
        cap: r.caption || (r.uploader ? r.uploader + "님 사진" : ""), thumb: pub(r.thumb_path), big: pub(r.path),
        visitor: r.kind !== "staff" })));
      sort(); draw();
    });
  }
  addEventListener("resize", () => { clearTimeout(window.__hgT); window.__hgT = setTimeout(draw, 200); });
})();
