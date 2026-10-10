/* 만화로 보는 용마거리 — 편 버튼으로 10컷씩 보여 주고, 크게 보기에서는 60컷을 순서대로 넘긴다.
   홈(index.html)과 이야기(story.html) 두 곳에서 같이 씁니다.
   #comic-tabs / #comic-grid 가 없는 페이지에서는 아무 일도 하지 않습니다. */
(function () {
  // 보여 줄 편 — 이미지 파일 번호(ep{n}). 기존 1편(2편과 겹침)·4편은 뺐다(2026-09-30)
  const EPS = [2, 3, 5, 6], EPISODES = EPS.length, PER = 10;
  const tabs = document.getElementById("comic-tabs"), grid = document.getElementById("comic-grid");
  const lb = document.getElementById("comic-lb"), img = document.getElementById("comic-img");
  const nextBtn = document.getElementById("comic-nextep");
  if (!tabs || !grid) return;
  const src = (ep, k) => `assets/img/comic/ep${EPS[ep - 1]}-${String(k).padStart(2, "0")}.webp?v=20261010`;   // ep = 화면의 편 번호(1부터) · ?v= 는 그림을 바꿨을 때 새로 받게
  const ALL = [];
  for (let e = 1; e <= EPISODES; e++) for (let k = 1; k <= PER; k++) ALL.push([e, k]);
  let ep = 1, cur = 0;

  tabs.innerHTML = Array.from({ length: EPISODES }, (_, i) =>
    `<button type="button" role="tab" data-ep="${i + 1}" aria-selected="${i === 0}">${i + 1}편</button>`).join("");

  function showEp(n, scroll) {
    ep = n;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", +b.dataset.ep === n));
    grid.innerHTML = Array.from({ length: PER }, (_, i) =>
      `<button class="comic__cell" type="button" data-i="${(n - 1) * PER + i}" aria-label="${n}편 ${i + 1}번째 장면 크게 보기">
         <img src="${src(n, i + 1)}" alt="만화로 보는 용마거리 ${n}편 ${i + 1}번째 장면" loading="lazy"></button>`).join("");
    if (nextBtn) nextBtn.textContent = n < EPISODES ? `${n + 1}편 보기 →` : "처음부터 다시 보기 ↺";
    if (scroll) document.getElementById("comic").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-ep]"); if (b) showEp(+b.dataset.ep); });
  if (nextBtn) nextBtn.addEventListener("click", () => showEp(ep < EPISODES ? ep + 1 : 1, true));
  showEp(1);

  // 크게 보기 — 60컷 전체를 순서대로
  const show = (i) => {
    cur = (i + ALL.length) % ALL.length;
    const [e, k] = ALL[cur];
    img.src = src(e, k); img.alt = `만화로 보는 용마거리 ${e}편 ${k}번째 장면`;
    document.getElementById("comic-meta").textContent = `${e}편 · ${k} / ${PER}`;
    if (e !== ep) showEp(e);                      // 넘기다 편이 바뀌면 아래 목록도 그 편으로
  };
  grid.addEventListener("click", (e) => { const c = e.target.closest(".comic__cell"); if (c) { show(+c.dataset.i); lb.showModal(); } });
  document.getElementById("comic-close").onclick = () => lb.close();
  document.getElementById("comic-prev").onclick = () => show(cur - 1);
  document.getElementById("comic-next").onclick = () => show(cur + 1);
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); x0 = null; });
})();
