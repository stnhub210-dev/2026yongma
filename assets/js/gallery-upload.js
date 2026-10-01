/* ==========================================================================
   방문객 사진 — 누구나 올리기 (로그인 없이)
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
    const day = `${when.getFullYear()}-${p2(when.getMonth() + 1)}-${p2(when.getDate())}`;
    const hm = `${p2(when.getHours())}:${p2(when.getMinutes())}`;

    const big = await shrink(file, BIG, 0.82);
    const small = await shrink(file, THUMB, 0.78);
    if (!big.blob || !small.blob) throw new Error("사진을 변환하지 못했습니다");

    const key = day.replace(/-/g, "") + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const path = key + ".webp";
    const thumb = key + "_t.webp";
    const opt = { contentType: "image/webp", cacheControl: "31536000" };

    let up = await c.storage.from(BUCKET).upload(path, big.blob, opt);
    if (up.error) throw up.error;
    up = await c.storage.from(BUCKET).upload(thumb, small.blob, opt);
    if (up.error) throw up.error;

    const ins = await c.from("gallery_uploads").insert({
      path, thumb_path: thumb,
      caption: meta.caption, uploader: meta.uploader,
      taken_on: day, taken_at: hm, w: big.w, h: big.h,
    });
    if (ins.error) throw ins.error;
  }

  /* ---------- 여러 장 올리기 (3장씩 나눠서) ---------- */
  async function putAll(files, meta, onStep) {
    let done = 0, failed = 0, next = 0;
    async function lane() {
      while (next < files.length) {
        const f = files[next++];
        try { await putOne(f, meta); } catch (e) { failed++; console.warn("업로드 실패:", f.name, e); }
        onStep(++done, files.length, failed);
      }
    }
    await Promise.all(Array.from({ length: Math.min(LANES, files.length) }, lane));
    return { done, failed };
  }

  /* ---------- 올라온 사진 목록 ---------- */
  let list = [];
  let loadError = "";

  async function load() {
    const c = sb();
    if (!c) return;
    const { data, error } = await c
      .from("gallery_uploads")
      .select("*")
      .order("taken_on", { ascending: false })
      .order("taken_at", { ascending: false })
      .limit(500);
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
      list = (data || []).map((r) => ({
        ...r,
        url: base.getPublicUrl(r.path).data.publicUrl,
        thumbUrl: base.getPublicUrl(r.thumb_path).data.publicUrl,
      }));
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
    grid.innerHTML = list.length
      ? list.map((p, i) => `
          <button class="gal-item" data-i="${i}" aria-label="${esc(p.caption || "방문객 사진")} 크게 보기">
            <img src="${p.thumbUrl}" alt="${esc(p.caption)}" loading="lazy" width="${p.w || 480}" height="${p.h || 360}">
            <span class="gal-item__cap"><b>${esc(p.taken_at || "")}</b>${esc(p.caption || (p.uploader ? p.uploader + "님" : ""))}</span>
          </button>`).join("")
      : `<p class="muted" style="grid-column:1/-1">첫 사진을 올려 주세요. 위의 버튼을 누르면 됩니다.</p>`;
  }

  /* ---------- 화면 붙이기 ---------- */
  function mount() {
    const host = $("#gal-upload");
    if (!host) return;

    if (!sb()) {
      host.innerHTML = `<p class="muted">사진 올리기는 준비 중입니다.</p>`;
      return;
    }

    host.innerHTML = `
      <div class="gal-up">
        <div class="gal-up__head">
          <div>
            <h2>방문객 사진</h2>
            <p class="muted mt-1">용마미식거리에서 찍은 사진을 누구나 올릴 수 있습니다. 올리면 바로 아래에 함께 보입니다.</p>
          </div>
          <span class="chip" id="up-count">—</span>
        </div>
        <div class="gal-up__form">
          <input class="input" id="up-name" type="text" maxlength="40" placeholder="이름 (선택)">
          <input class="input" id="up-cap" type="text" maxlength="200" placeholder="사진 설명 (선택) — 예: 골목어게인 버스킹 공연">
        </div>
        <div class="gal-up__btns">
          <button class="btn btn--primary" id="up-files" type="button">사진 올리기</button>
          <button class="btn btn--ghost" id="up-dir" type="button">폴더 사진 모두 올리기</button>
          <span class="gal-up__msg" id="up-msg"></span>
        </div>
        <p class="tiny muted mt-2">
          한 번에 최대 ${MAX_FILES}장 · 올리는 동안 창을 닫지 마십시오 ·
          올린 사진은 용마미식거리 홍보에 쓰일 수 있습니다 ·
          다른 사람의 얼굴이 크게 나온 사진은 당사자 동의를 받아 올려 주십시오.
        </p>
        <input type="file" id="up-in-files" accept="image/*" multiple hidden>
        <input type="file" id="up-in-dir" accept="image/*" multiple webkitdirectory directory hidden>
      </div>
      <div class="gal-grid" id="up-grid"></div>`;

    const msg = $("#up-msg");
    const btnF = $("#up-files"), btnD = $("#up-dir");
    const inF = $("#up-in-files"), inD = $("#up-in-dir");

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
      };

      btnF.disabled = btnD.disabled = true;
      msg.textContent = `0 / ${files.length} 올리는 중…`;
      const r = await putAll(files, meta, (done, total, failed) => {
        msg.textContent = `${done} / ${total} 올리는 중…` + (failed ? ` (실패 ${failed})` : "");
      });
      btnF.disabled = btnD.disabled = false;

      const ok = r.done - r.failed;
      msg.textContent =
        `${ok}장을 올렸습니다.` +
        (r.failed ? ` ${r.failed}장은 실패했습니다.` : "") +
        (skipped ? ` 사진이 아니거나 너무 큰 파일 ${skipped}개는 건너뛰었습니다.` : "");
      $("#up-cap").value = "";
      await load();
    }

    $("#up-grid").addEventListener("click", (e) => {
      const it = e.target.closest(".gal-item");
      if (!it || !window.GalleryLightbox) return;
      window.GalleryLightbox(list.map((p) => ({
        url: p.url,
        caption: p.caption || (p.uploader ? p.uploader + "님이 올린 사진" : "방문객 사진"),
        meta: `${dayLong(p.taken_on)} ${p.taken_at || ""}`.trim(),
      })), +it.dataset.i);
    });

    load();
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
