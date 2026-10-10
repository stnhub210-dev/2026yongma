/* ==========================================================================
   우리 가게 음식 자랑하기 (foodshow.html) — 갤러리 · 당첨 가게 · 응모
   · 서버 쪽 표·규칙은 supabase/food.sql (먼저 SQL Editor 에서 실행해야 동작)
   · 응모: 로그인 없이. 사진은 브라우저에서 줄여서 'food' 저장소에 올리고 food_submit 함수로 등록.
           연락처는 비공개 표에 들어가고, 사진은 응모 즉시 갤러리에 보인다(관리자가 숨김·반려 가능).
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
    const cols = "id,round,shop_name,menu_name,intro,photo_path,photo_thumb,winner,created_at";
    const q = (s) => c.from("food_entries").select(s).eq("status", "approved").order("created_at", { ascending: false }).limit(1000);
    let { data, error } = await q(cols + ",photos");
    if (error && /photos/.test(error.message)) ({ data, error } = await q(cols));      // SQL 실행 전 호환
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

  // 크게 보기 — 간판·내부·음식 사진을 ‹ › 로 넘겨 본다
  const KIND = { sign: "간판", inside: "내부 전경", food: "음식" };
  const lb = $("#fs-lb");
  let shots = [], cur = 0, curE = null;
  function show(i) {
    cur = (i + shots.length) % shots.length;
    const s = shots[cur];
    $("#fs-lb-img").src = pub(s.path);
    $("#fs-lb-img").alt = `${curE.shop_name} ${KIND[s.kind] || ""}`;
    $("#fs-lb-cap").textContent = `${curE.shop_name} — ${curE.menu_name}`;
    $("#fs-lb-meta").textContent = `${KIND[s.kind] || "사진"} · ${cur + 1} / ${shots.length} · ${ROUND[curE.round] || curE.round} 회차${curE.winner ? " · 이달의 맛집" : ""}`;
    $("#fs-lb-prev").hidden = $("#fs-lb-next").hidden = shots.length < 2;
  }
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".fs-card__img"); if (!btn) return;
    const e = entries.find((x) => String(x.id) === btn.closest(".fs-card").dataset.id); if (!e) return;
    curE = e;
    const order = { food: 0, sign: 1, inside: 2 };                     // 음식 → 간판 → 내부
    shots = (e.photos && e.photos.length ? e.photos.slice() : [{ kind: "food", path: e.photo_path, thumb: e.photo_thumb }])
      .sort((x, y) => (order[x.kind] ?? 9) - (order[y.kind] ?? 9));
    show(0); lb.showModal();
  });
  $("#fs-lb-close").onclick = () => lb.close();
  $("#fs-lb-prev").onclick = () => show(cur - 1);
  $("#fs-lb-next").onclick = () => show(cur + 1);
  lb.addEventListener("click", (ev) => { if (ev.target === lb) lb.close(); });
  lb.addEventListener("keydown", (ev) => { if (ev.key === "ArrowLeft") show(cur - 1); if (ev.key === "ArrowRight") show(cur + 1); });

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
  /* 사진 칸 — 칸마다 고른 파일을 모아 두고 미리 보기 · 빼기 */
  const MAX_N = 9, MIN_N = 3;
  const picked = { sign: [], inside: [], food: [] };
  const total = () => picked.sign.length + picked.inside.length + picked.food.length;
  function paintUp() {
    document.querySelectorAll(".fs-up__slot").forEach((slot) => {
      const k = slot.dataset.kind;
      slot.querySelector(".fs-up__list").innerHTML = picked[k].map((f, i) =>
        `<span class="fs-up__item"><img src="${f._url}" alt=""><button type="button" data-rm="${i}" aria-label="빼기">×</button></span>`).join("");
      slot.classList.toggle("is-ok", picked[k].length > 0);
    });
    const n = total(), need = ["sign", "inside", "food"].filter((k) => !picked[k].length).map((k) => KIND[k]);
    $("#fs-up-count").textContent = `${n} / ${MAX_N}장` + (need.length ? ` · ${need.join("·")} 사진이 필요해요` : n < MIN_N ? " · 3장 이상 올려 주세요" : " · 좋아요!");
    $("#fs-up-count").classList.toggle("is-ok", !need.length && n >= MIN_N);
  }
  document.querySelectorAll(".fs-up__slot").forEach((slot) => {
    const k = slot.dataset.kind, inp = slot.querySelector("input[type=file]");
    inp.addEventListener("change", () => {
      for (const f of inp.files) {
        if (!/^image\//.test(f.type) || f.size > MAX_SRC) { msg(fmsg, "err", "사진 파일(30MB 이하)만 올릴 수 있어요."); continue; }
        if (total() >= MAX_N) { msg(fmsg, "warn", `사진은 모두 합쳐 ${MAX_N}장까지 올릴 수 있어요.`); break; }
        f._url = URL.createObjectURL(f); picked[k].push(f);
      }
      inp.value = ""; paintUp();
    });
    slot.querySelector(".fs-up__list").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-rm]"); if (!b) return;
      picked[k].splice(+b.dataset.rm, 1); paintUp();
    });
  });

  const ERR = { CLOSED: "응모 기간(2026. 10. 10. ~ 11. 30.)이 아닙니다.", DAILY_LIMIT: "오늘은 응모를 더 받을 수 없어요. 내일 다시 응모해 주세요.",
    BAD_PHONE: "연락처를 숫자로 정확히 적어 주세요. (예: 010-1234-5678)", BAD_COUNT: "사진은 3장 이상 9장 이하로 올려 주세요.",
    NEED_SIGN: "간판 사진을 1장 이상 올려 주세요.", NEED_INSIDE: "내부 전경 사진을 1장 이상 올려 주세요.", NEED_FOOD: "음식 사진을 1장 이상 올려 주세요." };
  const form = $("#fs-form"), fmsg = $("#fs-msg");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fmsg.className = "alert";
    const c = sb();
    if (!c) return msg(fmsg, "err", "지금은 응모를 받을 수 없습니다. 잠시 후 다시 시도해 주세요.");
    if ($("#f-website").value) return;
    const v = (id) => $(id).value.trim();
    const shop = v("#f-shop"), menu = v("#f-menu"), intro = v("#f-intro"), owner = v("#f-owner"), phone = v("#f-phone");
    if (!shop || !menu) return msg(fmsg, "err", "가게 이름과 대표 메뉴를 적어 주세요.");
    if (!owner || !/^[0-9\-\s]{9,15}$/.test(phone)) return msg(fmsg, "err", "사장님 성함과 연락처를 정확히 적어 주세요.");
    const need = ["sign", "inside", "food"].find((k) => !picked[k].length);
    if (need) return msg(fmsg, "err", ERR["NEED_" + need.toUpperCase()]);
    if (total() < MIN_N || total() > MAX_N) return msg(fmsg, "err", ERR.BAD_COUNT);
    if (!["#f-a1", "#f-a2", "#f-a3"].every((id) => $(id).checked)) return msg(fmsg, "err", "필수 동의 세 가지에 체크해 주세요.");

    const btn = $("#f-submit"); btn.disabled = true;
    const base = `entries/${kst().slice(0, 10).replace(/-/g, "")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const uploaded = [];
    try {
      const list = ["food", "sign", "inside"].flatMap((k) => picked[k].map((f) => ({ k, f })));   // 음식 먼저 = 대표
      const photos = [];
      let i = 0, rep = null;
      for (const { k, f } of list) {
        i++; btn.textContent = `사진 올리는 중… (${i}/${list.length})`;
        const [big, th] = await Promise.all([shrink(f, BIG, .85), shrink(f, THUMB, .8)]);
        const pth = `${base}_${i}.webp`, tth = `${base}_${i}_t.webp`;
        const put = (p, b) => c.storage.from(BUCKET).upload(p, b, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        const ups = await Promise.all([put(pth, big.blob), put(tth, th.blob)]);
        const bad = ups.find((u) => u.error); if (bad) throw bad.error;
        uploaded.push(pth, tth);
        photos.push({ kind: k, path: pth, thumb: tth });
        if (!rep && k === "food") rep = { path: pth, thumb: tth, w: big.w, h: big.h };
      }
      btn.textContent = "응모 접수 중…";
      const { error } = await c.rpc("food_submit", { p_shop: shop, p_menu: menu, p_intro: intro, p_owner: owner, p_phone: phone,
        p_photo: rep.path, p_thumb: rep.thumb, p_w: rep.w, p_h: rep.h, p_photos: photos });
      if (error) {
        const k = Object.keys(ERR).find((x) => error.message.includes(x));
        throw new Error(k ? ERR[k] : error.message);
      }
      form.reset(); picked.sign = []; picked.inside = []; picked.food = []; paintUp();
      msg(fmsg, "ok", "응모 완료! 갤러리에 바로 올라갔어요. 다른 메뉴도 응모할 수 있어요.");
      await load();
    } catch (err) {
      if (uploaded.length) await c.storage.from(BUCKET).remove(uploaded).catch(() => {});   // 실패 → 올린 파일 치우기
      msg(fmsg, "err", "응모하지 못했습니다: " + (err.message || err));
    } finally {
      btn.disabled = false; btn.textContent = "응모하기";
    }
  });
  paintUp();

  load();
})();
