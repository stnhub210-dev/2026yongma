/* ==========================================================================
   우리 가게 음식 자랑하기 (foodshow.html) — 갤러리 · 당첨 가게 · 응모
   · 서버 쪽 표·규칙은 supabase/food.sql (먼저 SQL Editor 에서 실행해야 동작)
   · 응모: 로그인 없이. 사진은 브라우저에서 줄여서 'food' 저장소에 올리고 food_submit 함수로 등록.
           연락처는 비공개 표에 들어가고, 관리자가 확인(공개)해야 갤러리에 보인다.
   ========================================================================== */
(function () {
  "use strict";
  const BUCKET = "food", BIG = 1600, THUMB = 600, MAX_SRC = 30 * 1024 * 1024;
  const ROUND = { "2026-10": "10월", "2026-11": "11월" };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sb = () => (window.Auth && Auth.ready() ? Auth.client() : null);
  const pub = (p) => sb().storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  const msg = (el, type, t) => { el.className = `alert alert--${type} show`; el.textContent = t; };
  const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString();

  let entries = [], round = "all";
  const grid = $("#fs-grid");

  async function load() {
    const c = sb();
    if (!c) { grid.innerHTML = '<p class="ct-empty">갤러리를 준비하고 있습니다.</p>'; return; }
    const { data, error } = await c.from("food_entries")
      .select("id,round,shop_name,menu_name,intro,photo_path,photo_thumb,winner,created_at")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(1000);
    if (error) {
      grid.innerHTML = /relation|does not exist|schema cache/i.test(error.message)
        ? '<p class="ct-empty">갤러리를 준비하고 있습니다. 곧 열립니다.</p>'
        : `<p class="ct-empty">불러오지 못했습니다. (${esc(error.message)})</p>`;
      return;
    }
    entries = data || [];
    draw(); drawWinners();
  }

  const card = (e, big) => `<article class="fs-card${e.winner ? " is-win" : ""}" data-id="${e.id}">
      <button type="button" class="fs-card__img" aria-label="${esc(e.shop_name)} ${esc(e.menu_name)} 크게 보기">
        <img src="${pub(e.photo_thumb)}" alt="" loading="lazy">
        ${e.winner ? '<span class="fs-win">🏆 이달의 맛집</span>' : ""}
        <span class="fs-round">${ROUND[e.round] || e.round}</span>
      </button>
      <div class="fs-card__body"><b>${esc(e.shop_name)}</b><span>${esc(e.menu_name)}</span>${e.intro && big !== false ? `<em>${esc(e.intro)}</em>` : ""}</div>
    </article>`;

  function draw() {
    document.querySelectorAll(".ct-cat button").forEach((b) => {
      const k = b.dataset.round, n = k === "all" ? entries.length : entries.filter((e) => e.round === k).length;
      b.classList.toggle("active", k === round);
      b.querySelector("small").textContent = n || "";
    });
    const list = entries.filter((e) => round === "all" || e.round === round);
    $("#fs-count").textContent = entries.length ? `${entries.length}건` : "";
    grid.innerHTML = list.length ? list.map((e) => card(e)).join("")
      : '<p class="ct-empty">아직 공개된 응모가 없어요. 우리 가게 대표 메뉴로 첫 자랑의 주인공이 되어 주세요! <a href="#enter">응모하기 →</a></p>';
  }

  function drawWinners() {
    const w = entries.filter((e) => e.winner);
    $("#winners").hidden = !w.length;
    $("#fs-winners").innerHTML = w.map((e) => card(e)).join("");
  }

  document.querySelector(".ct-cat").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-round]"); if (!b) return;
    round = b.dataset.round; draw();
  });

  // 크게 보기
  const lb = $("#fs-lb");
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".fs-card__img"); if (!btn) return;
    const e = entries.find((x) => String(x.id) === btn.closest(".fs-card").dataset.id); if (!e) return;
    $("#fs-lb-img").src = pub(e.photo_path);
    $("#fs-lb-img").alt = `${e.shop_name} ${e.menu_name}`;
    $("#fs-lb-cap").textContent = `${e.shop_name} — ${e.menu_name}`;
    $("#fs-lb-meta").textContent = `${ROUND[e.round] || e.round} 회차${e.winner ? " · 이달의 맛집" : ""}${e.intro ? " · " + e.intro : ""}`;
    lb.showModal();
  });
  $("#fs-lb-close").onclick = () => lb.close();
  lb.addEventListener("click", (ev) => { if (ev.target === lb) lb.close(); });

  /* ---------- 응모 ---------- */
  async function shrink(file, max, q) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/webp", q));
    if (!blob) throw new Error("사진을 변환하지 못했습니다. 다른 사진으로 시도해 주세요.");
    return { blob, w, h };
  }
  const box = $("#drop-photo"), input = $("#f-photo");
  input.addEventListener("change", () => {
    const f = input.files[0], img = box.querySelector("img");
    if (!f) { img.hidden = true; box.classList.remove("has"); return; }
    img.src = URL.createObjectURL(f); img.hidden = false; box.classList.add("has");
    box.querySelector("span").textContent = f.name;
  });

  const ERR = { CLOSED: "응모 기간(2026. 10. 10. ~ 11. 30.)이 아닙니다.", DAILY_LIMIT: "오늘은 응모를 더 받을 수 없어요. 내일 다시 응모해 주세요.",
    BAD_PHONE: "연락처를 숫자로 정확히 적어 주세요. (예: 010-1234-5678)" };
  const form = $("#fs-form"), fmsg = $("#fs-msg");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fmsg.className = "alert";
    const c = sb();
    if (!c) return msg(fmsg, "err", "지금은 응모를 받을 수 없습니다. 잠시 후 다시 시도해 주세요.");
    if ($("#f-website").value) return;
    const v = (id) => $(id).value.trim();
    const shop = v("#f-shop"), menu = v("#f-menu"), intro = v("#f-intro"), owner = v("#f-owner"), phone = v("#f-phone");
    const photo = input.files[0];
    if (!shop || !menu) return msg(fmsg, "err", "가게 이름과 대표 메뉴를 적어 주세요.");
    if (!owner || !/^[0-9\-\s]{9,15}$/.test(phone)) return msg(fmsg, "err", "사장님 성함과 연락처를 정확히 적어 주세요.");
    if (!photo || !/^image\//.test(photo.type) || photo.size > MAX_SRC) return msg(fmsg, "err", "음식 사진(30MB 이하)을 골라 주세요.");
    if (!["#f-a1", "#f-a2", "#f-a3"].every((id) => $(id).checked)) return msg(fmsg, "err", "필수 동의 세 가지에 체크해 주세요.");

    const btn = $("#f-submit"); btn.disabled = true; btn.textContent = "사진 올리는 중…";
    try {
      const [big, thumb] = await Promise.all([shrink(photo, BIG, .85), shrink(photo, THUMB, .8)]);
      const base = `entries/${kst().slice(0, 10).replace(/-/g, "")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const paths = [`${base}.webp`, `${base}_t.webp`];
      const put = (p, b) => c.storage.from(BUCKET).upload(p, b, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      const ups = await Promise.all([put(paths[0], big.blob), put(paths[1], thumb.blob)]);
      const bad = ups.find((u) => u.error); if (bad) throw bad.error;
      const { error } = await c.rpc("food_submit", { p_shop: shop, p_menu: menu, p_intro: intro, p_owner: owner, p_phone: phone,
        p_photo: paths[0], p_thumb: paths[1], p_w: big.w, p_h: big.h });
      if (error) {
        await c.storage.from(BUCKET).remove(paths);
        const k = Object.keys(ERR).find((x) => error.message.includes(x));
        throw new Error(k ? ERR[k] : error.message);
      }
      form.reset(); box.classList.remove("has"); box.querySelector("img").hidden = true; box.querySelector("span").textContent = "사진 고르기";
      msg(fmsg, "ok", "응모가 접수되었습니다! 담당자가 상인회 회원 점포인지 확인한 뒤 갤러리에 공개합니다. 다른 메뉴도 응모할 수 있어요.");
    } catch (err) {
      msg(fmsg, "err", "응모하지 못했습니다: " + (err.message || err));
    } finally {
      btn.disabled = false; btn.textContent = "응모하기";
    }
  });

  load();
})();
