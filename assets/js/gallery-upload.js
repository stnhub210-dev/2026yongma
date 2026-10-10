/* ==========================================================================
   사진 올리기 — 방문객(로그인 없이) / 수행사(직원 계정)
   · 방문객 사진은 이 칸 아래 "방문객 사진" 에, 수행사 사진은 위쪽 날짜별 갤러리에 섞여 보입니다.
   · 날짜를 고르면 그 날짜로 들어가고, 비워 두면 사진에 찍힌 날짜를 씁니다.
   · 사진은 Supabase 저장소(gallery 버킷)에, 목록은 gallery_uploads 표에 들어갑니다.
   · 올리기 전에 브라우저에서 크기를 줄입니다. 폰 사진 한 장이 5MB라 그대로 올리면
     무료 용량(1GB)이 금방 차고, 보는 사람도 느려집니다.
   · 찍은 날짜는 사진 안의 EXIF 정보에서 읽고, 없으면 파일 날짜를 씁니다.
   저장소·표를 만드는 SQL 은 supabase/gallery.sql 에 있습니다.
   ========================================================================== */
(function () {
  "use strict";

  const BUCKET = "gallery";
  const MAX_FILES = 200;          // 한 번에 올릴 수 있는 장수
  const MAX_SRC = 30 * 1024 * 1024; // 원본 한 장 최대 크기
  const BIG = 1600;               // 크게 보기용 긴 변 길이
  const THUMB = 480;              // 목록용 긴 변 길이
  const LANES = 3;                // 동시에 올리는 개수

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  const sb = () => (window.Auth && Auth.ready() ? Auth.client() : null);

  /* ---------- 내가 올린 사진 기억하기 ----------
     로그인이 없으므로 "누가 올렸는지" 를 알 수 없습니다. 사진마다 임의의 열쇠를
     만들어 이 브라우저에만 남겨 두고, 그 열쇠로 본인 사진만 지울 수 있게 합니다.
     (브라우저를 바꾸거나 기록을 지우면 삭제 버튼이 사라집니다) */
  const MINE_KEY = "yongma_my_photos";
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || {}; } catch (e) { return {}; } };
  const remember = (id, key) => { try { const m = mine(); m[id] = key; localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (e) { /* 저장 못 해도 올리기는 됩니다 */ } };
  const forget = (id) => { try { const m = mine(); delete m[id]; localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (e) { /* 무시 */ } };
  const newKey = () => {
    const a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256)));
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  /* ---------- 사진에서 찍은 날짜 읽기 (JPEG EXIF) ---------- */
  async function shotTime(file) {
    const fallback = new Date(file.lastModified || Date.now());
    if (!/jpe?g/i.test(file.type)) return fallback;
    try {
      const v = new DataView(await file.slice(0, 131072).arrayBuffer());
      if (v.getUint16(0) !== 0xffd8) return fallback;      // JPEG 시작 표시가 아니면 포기
      let off = 2;
      while (off + 4 < v.byteLength) {
        const marker = v.getUint16(off);
        if (marker === 0xffe1) break;                      // EXIF 가 들어 있는 구역
        if ((marker & 0xff00) !== 0xff00) return fallback;
        off += 2 + v.getUint16(off + 2);
      }
      if (off + 10 >= v.byteLength || v.getUint32(off + 4) !== 0x45786966) return fallback;  // "Exif"
      const tiff = off + 10;
      const le = v.getUint16(tiff) === 0x4949;             // 바이트 순서(리틀/빅 엔디안)
      const text = (p) => {
        let s = "";
        for (let k = 0; k < 19; k++) s += String.fromCharCode(v.getUint8(p + k));
        return s;
      };
      const scan = (dir) => {
        const n = v.getUint16(dir, le);
        let found = null, sub = 0;
        for (let i = 0; i < n; i++) {
          const e = dir + 2 + i * 12;
          const tag = v.getUint16(e, le);
          if (tag === 0x9003) return text(tiff + v.getUint32(e + 8, le));  // 촬영 일시(가장 정확)
          if (tag === 0x0132 && !found) found = text(tiff + v.getUint32(e + 8, le));
          if (tag === 0x8769) sub = tiff + v.getUint32(e + 8, le);         // 상세 정보 위치
        }
        return (sub && scan(sub)) || found;
      };
      const s = scan(tiff + v.getUint32(tiff + 4, le));
      const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
      if (!m) return fallback;
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    } catch (e) {
      return fallback;
    }
  }

  /* ---------- 크기 줄이기 ---------- */
  async function shrink(file, max, quality) {
    // from-image: 폰으로 세로로 찍은 사진이 눕지 않게 회전 정보를 반영합니다
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * r));
    const h = Math.max(1, Math.round(bmp.height * r));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, "image/webp", quality));
    return { blob, w, h };
  }

  /* ---------- 한 장 올리기 ---------- */
  async function putOne(file, meta) {
    const c = sb();
    const when = await shotTime(file);
    const p2 = (n) => String(n).padStart(2, "0");
    // 날짜를 골랐으면 그 날짜, 아니면 사진에 찍힌 날짜. 시각은 사진에서 읽은 값을 그대로 씁니다.
    const day = meta.day || `${when.getFullYear()}-${p2(when.getMonth() + 1)}-${p2(when.getDate())}`;
    const hm = `${p2(when.getHours())}:${p2(when.getMinutes())}`;

    const big = await shrink(file, BIG, 0.82);
    const small = await shrink(file, THUMB, 0.78);
    if (!big.blob || !small.blob) throw new Error("사진을 변환하지 못했습니다");

    const stem = day.replace(/-/g, "") + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const path = stem + ".webp";
    const thumb = stem + "_t.webp";
    const opt = { contentType: "image/webp", cacheControl: "31536000" };

    let up = await c.storage.from(BUCKET).upload(path, big.blob, opt);
    if (up.error) throw up.error;
    up = await c.storage.from(BUCKET).upload(thumb, small.blob, opt);
    if (up.error) throw up.error;

    const row = {
      path, thumb_path: thumb,
      caption: meta.caption, uploader: meta.uploader,
      taken_on: day, taken_at: hm, w: big.w, h: big.h,
    };
    if (meta.kind === "staff") row.kind = "staff";   // 방문객은 기본값(visitor)
    const ins = await c.from("gallery_uploads").insert(row).select("id").single();
    if (ins.error) throw ins.error;

    // 올린 본인만 지울 수 있도록 열쇠를 하나 남깁니다
    const key = newKey();
    const k = await c.from("gallery_upload_keys").insert({ photo_id: ins.data.id, delete_key: key });
    if (!k.error) remember(ins.data.id, key);
  }

  /* ---------- 내가 올린 사진 지우기 ---------- */
  async function removeOne(id) {
    const c = sb();
    const key = mine()[id];
    if (!c || !key) return false;
    const { data, error } = await c.rpc("gallery_delete", { p_id: id, p_key: key });
    if (error) { console.warn("삭제 실패:", error); return false; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return false;                        // 열쇠가 맞지 않았습니다
    // 목록에서 빠진 뒤에야 파일을 치울 수 있습니다(정책이 그렇게 되어 있습니다)
    await c.storage.from(BUCKET).remove([row.path, row.thumb_path].filter(Boolean));
    forget(id);
    return true;
  }

  /* ---------- 여러 장 올리기 (3장씩 나눠서) ---------- */
  async function putAll(files, meta, onStep) {
    let done = 0, failed = 0, next = 0, lastError = null;
    async function lane() {
      while (next < files.length) {
        const f = files[next++];
        try { await putOne(f, meta); } catch (e) { failed++; lastError = e; console.warn("업로드 실패:", f.name, e); }
        onStep(++done, files.length, failed);
      }
    }
    await Promise.all(Array.from({ length: Math.min(LANES, files.length) }, lane));
    return { done, failed, lastError };
  }

  /* ---------- 수행사 사진 지우기 (직원 계정) ---------- */
  async function removeStaff(id) {
    const c = sb();
    if (!c) return false;
    // 목록에서 먼저 빼고(직원 정책), 돌려받은 경로로 파일을 치웁니다
    const { data, error } = await c.from("gallery_uploads").delete()
      .eq("id", id).eq("kind", "staff").select("path, thumb_path");
    if (error || !data || !data.length) { console.warn("삭제 실패:", error); return false; }
    await c.storage.from(BUCKET).remove([data[0].path, data[0].thumb_path].filter(Boolean));
    return true;
  }

  window.GalleryDeleteStaff = async (id, btn) => {
    if (!confirm("이 수행사 사진을 지울까요? 되돌릴 수 없습니다.")) return;
    btn.disabled = true;
    btn.textContent = "지우는 중…";
    const ok = await removeStaff(id);
    if (!ok) {
      btn.disabled = false;
      btn.textContent = "지우기";
      alert("사진을 지우지 못했습니다. 직원 계정으로 로그인했는지 확인해 주십시오.");
      return;
    }
    await load();
  };

  /* ---------- 올라온 사진 목록 ---------- */
  let list = [];        // 방문객 사진 (아래 칸)
  let loadError = "";
  let isStaff = false;  // 직원·관리자 계정으로 로그인했는지

  async function load() {
    const c = sb();
    if (!c) return;
    const { data, error } = await c
      .from("gallery_uploads")
      .select("*")
      .order("taken_on", { ascending: false })
      .order("taken_at", { ascending: false })
      .limit(1000);
    if (error) {
      console.warn("방문객 사진을 불러오지 못했습니다:", error);
      // 표가 아직 없으면(= SQL 미실행) 관리자에게만 뜻이 통하는 안내를 둡니다
      loadError = /relation|does not exist|schema cache/i.test(error.message || "")
        ? "사진 보관함이 아직 준비되지 않았습니다. (supabase/gallery.sql 실행 필요)"
        : "사진을 불러오지 못했습니다. 잠시 후 다시 열어 주십시오.";
      list = [];
    } else {
      loadError = "";
      const base = c.storage.from(BUCKET);
      const rows = (data || []).map((r) => ({
        ...r,
        url: base.getPublicUrl(r.path).data.publicUrl,
        thumbUrl: base.getPublicUrl(r.thumb_path).data.publicUrl,
      }));
      // kind 칸이 없던 예전 사진은 방문객 사진으로 봅니다
      list = rows.filter((r) => (r.kind || "visitor") !== "staff");
      // 수행사 사진은 위쪽 날짜별 갤러리로 보냅니다
      if (window.GallerySetStaff) {
        window.GallerySetStaff(rows.filter((r) => r.kind === "staff" && r.taken_on).map((r) => ({
          dbId: r.id,
          date: r.taken_on,
          time: r.taken_at || "",
          caption: r.caption || "",
          w: r.w, h: r.h,
          src: r.url,
          thumb: r.thumbUrl,
          canDelete: isStaff,
        })));
      }
    }
    draw();
  }

  function dayLong(d) {
    if (!d) return "";
    const [y, m, dd] = d.split("-").map(Number);
    return `${y}년 ${m}월 ${dd}일 ${WEEK[new Date(y, m - 1, dd).getDay()]}요일`;
  }

  function draw() {
    const grid = $("#up-grid"), count = $("#up-count");
    if (!grid) return;
    count.textContent = list.length ? `${list.length}장` : loadError ? "준비 중" : "아직 없음";
    if (loadError) { grid.innerHTML = `<p class="muted" style="grid-column:1/-1">${esc(loadError)}</p>`; return; }
    const m = mine();
    grid.innerHTML = list.length
      ? list.map((p, i) => `
          <div class="gal-cell">
            <button class="gal-item" data-i="${i}" aria-label="${esc(p.caption || "방문객 사진")} 크게 보기">
              <img src="${p.thumbUrl}" alt="${esc(p.caption)}" loading="lazy" width="${p.w || 480}" height="${p.h || 360}">
              <span class="gal-item__cap"><b>${esc(p.taken_at || "")}</b>${esc(p.caption || (p.uploader ? p.uploader + "님" : ""))}</span>
            </button>
            ${m[p.id] ? `<button class="gal-del" data-del="${p.id}" type="button" title="내가 올린 사진 지우기">지우기</button>` : ""}
          </div>`).join("")
      : `<p class="muted" style="grid-column:1/-1">첫 사진을 올려 주세요. 「📷 사진 올리기」를 누르면 됩니다.</p>`;
  }

  /* ---------- 화면 붙이기 ---------- */
  function mount() {
    const host = $("#gal-upload");
    if (!host) return;

    if (!sb()) {
      host.innerHTML = `<p class="muted">사진 올리기는 준비 중입니다.</p>`;
      return;
    }

    const p2 = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const today = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;

    // 방문객 사진 칸 — 제목 · 장수 · 올리기 버튼 · 사진 목록 (올리기 양식은 팝업)
    host.innerHTML = `
      <div class="gal-up gal-up--slim">
        <div class="gal-up__head">
          <div>
            <h2>방문객 사진</h2>
            <p class="muted mt-1">용마미식거리를 찾은 분들이 올린 사진입니다. 누구나 올릴 수 있어요.</p>
          </div>
          <div class="gal-up__headr">
            <span class="chip" id="up-count">—</span>
            <button class="btn btn--primary btn--sm" type="button" data-up-open>📷 사진 올리기</button>
          </div>
        </div>
        <p class="gal-up__done" id="up-done" hidden></p>
      </div>
      <div class="gal-grid" id="up-grid"></div>`;

    // 팝업 — ① 올리는 사람 ② 날짜 ③ 사진 파일
    const dlg = document.createElement("dialog");
    dlg.className = "up-dlg";
    dlg.id = "up-dlg";
    dlg.setAttribute("aria-label", "사진 올리기");
    dlg.innerHTML = `
      <form method="dialog" class="up-dlg__box" onsubmit="return false">
        <div class="up-dlg__head"><h3>📷 사진 올리기</h3><button type="button" class="up-dlg__x" data-up-close aria-label="닫기">×</button></div>

        <p class="up-dlg__step"><span>1</span>누가 올리나요?</p>
        <div class="up-dlg__who" role="radiogroup" aria-label="올리는 사람">
          <label><input type="radio" name="up-kind" value="visitor" checked><span><b>🙋 방문객</b><small>아래 '방문객 사진'에 올라가요</small></span></label>
          <label><input type="radio" name="up-kind" value="staff"><span><b>🎬 수행사</b><small>STN·상인회·기획사 — 날짜별 갤러리로</small></span></label>
        </div>
        <p class="tiny muted" id="up-kind-note" style="min-height:1.2em"></p>

        <p class="up-dlg__step"><span>2</span>언제 찍은 사진인가요?</p>
        <input class="input" id="up-date" type="date" min="2026-09-01" max="${today}" value="${today}">
        <p class="tiny muted" id="up-date-note">날짜를 비워 두면 사진에 찍힌 날짜로 들어갑니다.</p>

        <p class="up-dlg__step"><span>3</span>사진 고르기</p>
        <div class="up-dlg__opt">
          <input class="input" id="up-name" type="text" maxlength="40" placeholder="이름 (선택)">
          <input class="input" id="up-cap" type="text" maxlength="200" placeholder="사진 설명 (선택) — 예: 골목어게인 버스킹 공연">
        </div>
        <div class="gal-up__btns">
          <button class="btn btn--primary" id="up-files" type="button">사진 파일 올리기</button>
          <button class="btn btn--ghost" id="up-dir" type="button">폴더 사진 모두 올리기</button>
        </div>
        <p class="gal-up__msg" id="up-msg" role="status"></p>
        <p class="tiny muted">한 번에 최대 ${MAX_FILES}장 · 올리는 동안 창을 닫지 마십시오 · 올린 사진은 용마미식거리 홍보에 쓰일 수 있습니다 ·
          다른 사람의 얼굴이 크게 나온 사진은 당사자 동의를 받아 올려 주십시오.</p>
        <input type="file" id="up-in-files" accept="image/*" multiple hidden>
        <input type="file" id="up-in-dir" accept="image/*" multiple webkitdirectory directory hidden>
      </form>`;
    document.body.appendChild(dlg);
    // 여는 버튼 — 페이지 맨 위 '사진 올리기'와 이 칸의 버튼 모두 [data-up-open]
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-up-open]")) { e.preventDefault(); $("#up-msg").textContent = ""; dlg.showModal(); }
      if (e.target.closest("[data-up-close]")) dlg.close();
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    if (location.hash === "#upload") setTimeout(() => dlg.showModal(), 300);

    const msg = $("#up-msg");
    const btnF = $("#up-files"), btnD = $("#up-dir");
    const inF = $("#up-in-files"), inD = $("#up-in-dir");

    /* 날짜 — 위쪽 날짜 버튼을 누르면 같은 날짜가 들어옵니다 */
    const dateIn = $("#up-date"), dateNote = $("#up-date-note");
    const paintDate = () => {
      const v = dateIn.value;
      if (!v) { dateNote.textContent = "날짜를 비워 두면 사진에 찍힌 날짜로 들어갑니다."; return; }
      dateNote.textContent = `고른 사진은 모두 ${dayLong(v)} 사진으로 들어갑니다.`;
    };
    dateIn.addEventListener("input", paintDate);
    paintDate();
    document.addEventListener("gal:day", (e) => {
      if (e.detail && e.detail !== "all") dateIn.value = e.detail;
      paintDate();
    });

    /* 올리는 사람 — 수행사는 직원 계정 로그인이 필요합니다 */
    const kindNote = $("#up-kind-note");
    const kind = () => (host.querySelector('input[name="up-kind"]:checked') || {}).value || "visitor";
    const base = document.documentElement.dataset.base || "";
    const paintKind = () => {
      if (kind() !== "staff") { kindNote.innerHTML = ""; return; }
      kindNote.innerHTML = isStaff
        ? "위쪽 날짜별 갤러리에 올라갑니다."
        : `수행사 사진은 직원 계정으로 <a href="${base}login.html">로그인</a>한 뒤 올릴 수 있습니다.`;
    };
    host.querySelectorAll('input[name="up-kind"]').forEach((r) => r.addEventListener("change", paintKind));

    btnF.onclick = () => inF.click();
    btnD.onclick = () => inD.click();
    inF.onchange = () => take(inF);
    inD.onchange = () => take(inD);

    async function take(input) {
      const picked = Array.from(input.files || []);
      input.value = "";                                   // 같은 파일을 다시 골라도 동작하게
      const files = picked.filter((f) => /^image\//.test(f.type) && f.size <= MAX_SRC);
      const skipped = picked.length - files.length;

      if (!files.length) {
        msg.textContent = picked.length ? "올릴 수 있는 사진이 없습니다." : "";
        return;
      }
      if (files.length > MAX_FILES) {
        msg.textContent = `한 번에 ${MAX_FILES}장까지 올릴 수 있습니다. 나눠서 올려 주십시오.`;
        return;
      }

      const meta = {
        uploader: $("#up-name").value.trim().slice(0, 40),
        caption: $("#up-cap").value.trim().slice(0, 200),
        day: /^\d{4}-\d{2}-\d{2}$/.test(dateIn.value) ? dateIn.value : "",
        kind: kind(),
      };
      if (meta.kind === "staff" && !isStaff) {
        msg.innerHTML = `수행사 사진은 직원 계정으로 <a href="${base}login.html">로그인</a>해야 올릴 수 있습니다.`;
        return;
      }

      btnF.disabled = btnD.disabled = true;
      msg.textContent = `0 / ${files.length} 올리는 중…`;
      const r = await putAll(files, meta, (done, total, failed) => {
        msg.textContent = `${done} / ${total} 올리는 중…` + (failed ? ` (실패 ${failed})` : "");
      });
      btnF.disabled = btnD.disabled = false;

      const ok = r.done - r.failed;
      // kind 칸이 없다는 오류 = gallery.sql 을 아직 다시 실행하지 않음
      const noKind = r.lastError && /kind/i.test(r.lastError.message || "");
      msg.textContent =
        `${ok}장을 ${meta.kind === "staff" ? "위쪽 날짜별 갤러리에" : "아래 방문객 사진에"} 올렸습니다.` +
        (r.failed ? ` ${r.failed}장은 실패했습니다.` : "") +
        (noKind ? " (사진 보관함 설정이 필요합니다 — supabase/gallery.sql 다시 실행)" : "") +
        (skipped ? ` 사진이 아니거나 너무 큰 파일 ${skipped}개는 건너뛰었습니다.` : "");
      $("#up-cap").value = "";
      await load();
      if (ok > 0) {
        const done = $("#up-done");
        done.textContent = msg.textContent;
        done.hidden = false;
        setTimeout(() => {
          dlg.close();
          if (meta.kind === "staff") {
            const sec = document.getElementById("d-" + (meta.day || ""));
            const btn = sec && document.querySelector(`#gal-filter button[data-d="${meta.day}"]`);
            if (btn) btn.click();                                    // 그 날짜만 보이게
            (sec || document.getElementById("gal-days")).scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            document.getElementById("visitor").scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 900);
      }
    }

    $("#up-grid").addEventListener("click", async (e) => {
      // 지우기 — 이 브라우저에서 올린 사진에만 버튼이 보입니다
      const del = e.target.closest("[data-del]");
      if (del) {
        if (!confirm("이 사진을 지울까요? 되돌릴 수 없습니다.")) return;
        del.disabled = true;
        del.textContent = "지우는 중…";
        const ok = await removeOne(+del.dataset.del);
        if (!ok) {
          del.disabled = false;
          del.textContent = "지우기";
          msg.textContent = "사진을 지우지 못했습니다. 이 브라우저에서 올린 사진만 지울 수 있습니다.";
          return;
        }
        msg.textContent = "사진을 지웠습니다.";
        await load();
        return;
      }

      const it = e.target.closest(".gal-item");
      if (!it || !window.GalleryLightbox) return;
      window.GalleryLightbox(list.map((p) => ({
        url: p.url,
        caption: p.caption || (p.uploader ? p.uploader + "님이 올린 사진" : "방문객 사진"),
        meta: `${dayLong(p.taken_on)} ${p.taken_at || ""}`.trim(),
      })), +it.dataset.i);
    });

    // 직원 계정인지 먼저 확인한 뒤 목록을 불러옵니다(수행사 사진 지우기 버튼 때문)
    (async () => {
      try { isStaff = !!(await Auth.isAdmin()); } catch (e) { isStaff = false; }
      paintKind();
      load();
    })();
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
