/* ==========================================================================
   용마미식거리 사진전 — 응모작 게시판 · 응모 · 시민투표 (contest.html)
   · 서버 쪽 표·규칙은 supabase/contest.sql (먼저 SQL Editor 에서 실행해야 동작)
   · 응모: 로그인 없이. 사진은 브라우저에서 줄여서 'contest' 저장소에 올린다.
           올린 사람 브라우저에 지우기 열쇠를 남겨 승인 전에도 직접 지울 수 있다.
   · 투표: 로그인한 사람만, 하루 10표. 실제 제한은 서버 함수 contest_vote 가 지킨다.
   ========================================================================== */
(function () {
  "use strict";

  const BUCKET = "contest";
  const BIG = 1600, THUMB = 560, PROOF = 1400;      // 긴 변 길이(px)
  const MAX_SRC = 30 * 1024 * 1024;
  const DAILY = 10;
  const MINE_KEY = "yongma_contest_mine";

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sb = () => (window.Auth && Auth.ready() ? Auth.client() : null);
  const pub = (path) => sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  /* 한국 시간 기준 오늘 "YYYY-MM-DD" — 서버도 같은 기준으로 하루를 센다 */
  const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

  const msg = (el, type, text) => { el.className = `alert alert--${type} show`; el.textContent = text; };
  const clear = (el) => { el.className = "alert"; el.textContent = ""; };

  /* ---------- 이 브라우저에서 응모한 작품 ---------- */
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || {}; } catch (e) { return {}; } };
  const saveMine = (m) => { try { localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (e) { /* 저장 못 해도 응모는 됨 */ } };
  const newKey = () => {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  /* ---------- 사진 줄이기 (사진 방향 반영 → webp) ---------- */
  async function shrink(file, max, quality) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/webp", quality));
    if (!blob) throw new Error("사진을 변환하지 못했습니다. 다른 사진으로 시도해 주세요.");
    return { blob, w, h };
  }

  /* ======================================================================
     게시판 — 부문(사진 photo / 동영상 short) 탭으로 나눠 보여 준다
     ====================================================================== */
  const CAT = { photo: "사진", short: "동영상" };
  let entries = [];
  let cat = /#short/.test(location.hash) ? "short" : /#photo/.test(location.hash) ? "photo" : "all";   // 지금 보는 탭(전체·사진·동영상)
  let sort = "new";
  let myVotes = new Set();     // 오늘 내가 투표한 작품 id
  let limitHit = false;        // 서버가 LIMIT(오늘 10표 다 씀) 라고 알려 줬는지
  let user = null;
  let open = true;             // 응모·투표 기간 안인지
  let failed = false;          // 목록을 못 불러왔으면 안내 문구를 그대로 둔다

  const grid = $("#ct-grid"), boardMsg = $("#ct-msg");

  function period() {
    const t = kstToday();
    open = t >= "2026-10-09" && t <= "2026-12-30";
  }

  /* 영상 게시물 주소 → 페이지 안에서 재생할 주소 (유튜브·인스타그램·틱톡). 모르는 주소면 null → 원문으로 연결 */
  function embedOf(u) {
    u = String(u);
    let m = u.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
    if (m) return { src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`, kind: "yt" };
    m = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i);
    if (m) return { src: `https://www.instagram.com/p/${m[1]}/embed/`, kind: "ig" };
    m = u.match(/tiktok\.com\/.*\/video\/(\d+)/i);
    if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, kind: "tt" };
    return null;
  }

  async function loadEntries() {
    const c = sb();
    if (!c) { grid.innerHTML = '<p class="ct-empty">사진전 게시판을 준비하고 있습니다.</p>'; failed = true; return; }
    const cols = "id,category,title,nickname,sns_url,story,photo_path,photo_thumb,proof_path,w,h,vote_count,created_at";
    const q = (s) => c.from("contest_entries").select(s).eq("status", "approved").order("created_at", { ascending: false }).limit(1000);
    let { data, error } = await q(cols + ",sns_post");
    if (error && /sns_post/.test(error.message)) ({ data, error } = await q(cols));      // SQL 실행 전 호환
    if (error) {
      failed = true;
      grid.innerHTML = /relation|does not exist|schema cache|column/i.test(error.message)
        ? '<p class="ct-empty">사진전 게시판을 준비하고 있습니다. 곧 열립니다.</p>'
        : `<p class="ct-empty">응모작을 불러오지 못했습니다. (${esc(error.message)})</p>`;
      return;
    }
    entries = data || [];
  }

  // 오늘 남은 표 — 사진·동영상 합산 하루 10표
  const leftOf = () => limitHit ? 0 : Math.max(DAILY - myVotes.size, 0);

  function draw() {
    document.querySelectorAll(".ct-cat button").forEach((b) => {
      const k = b.dataset.cat, n = k === "all" ? entries.length : entries.filter((e) => e.category === k).length;
      b.classList.toggle("active", k === cat);
      b.querySelector("small").textContent = n ? n : "";
    });
    const list = failed ? [] : entries.filter((e) => cat === "all" || e.category === cat).sort((a, b) =>
      sort === "vote" ? (b.vote_count - a.vote_count) || (b.id - a.id) : b.id - a.id);
    const total = list.length;
    // 게시판 머리줄 (번호 · 작품 · 득표 · 투표)
    const head = `<div class="ct-row ct-row--head" aria-hidden="true"><span>번호</span><span></span><span>작품</span><span>득표</span><span></span></div>`;
    const ymd = (s) => { const d = new Date(new Date(s).getTime() + 9 * 3600e3); return `${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`; };
    const isNew = (s) => Date.now() - new Date(s).getTime() < 24 * 3600e3;

    if (!list.length) {                       // 응모작이 없으면 '예시' 줄로 채운다 (contest-samples.js)
      const ex = (window.CONTEST_SAMPLES || []).filter((s) => cat === "all" || s.category === cat);
      drawChart(ex.map((s) => ({ title: s.title, nickname: s.nickname, votes: s.votes, category: s.category })), true);
      grid.innerHTML = `<p class="ct-empty ct-empty--ex">아직 게시된 ${cat === "all" ? "" : CAT[cat] + " "}응모작이 없어요. 아래는 <b>예시</b>입니다 — 첫 번째 주인공이 되어 주세요! <a href="#enter">응모하기 →</a></p>` +
        `<div class="ct-list">${head}` +
        ex.map((s, i) => `<div class="ct-row ct-row--sample">
          <span class="ct-row__no">예시</span>
          <span class="ct-row__img"><img src="assets/img/gallery/${s.img}_t.webp" alt="" loading="lazy">${s.category === "short" ? '<i class="ct-play" aria-hidden="true">▶</i>' : ""}</span>
          <span class="ct-row__main"><b>${esc(s.title)}</b><small>by ${esc(s.nickname)}</small>${s.story ? `<em>${esc(s.story)}</em>` : ""}</span>
          <span class="ct-row__count"><b>${s.votes}</b>표</span>
          <span class="ct-row__act"><button type="button" class="btn btn--sm btn--ghost" disabled>예시</button></span>
        </div>`).join("") + `</div>`;
      return;
    }
    drawChart(list.map((e) => ({ id: e.id, title: e.title, nickname: e.nickname, votes: e.vote_count, category: e.category })), false);
    const left = leftOf();
    grid.innerHTML = `<div class="ct-list">${head}` + list.map((e, i) => {
      const voted = myVotes.has(e.id), short = e.category === "short";
      const off = voted || !open || (user && left === 0);
      const no = sort === "vote" ? `${i + 1}위` : total - i;            // 최신순은 글 번호, 득표순은 순위
      return `<div class="ct-row" data-id="${e.id}">
        <span class="ct-row__no">${no}</span>
        <button type="button" class="ct-row__img" data-view="photo" aria-label="${esc(e.title)} ${short ? "영상 보기" : "크게 보기"}">
          <img src="${pub(e.photo_thumb)}" alt="" loading="lazy">${short ? '<i class="ct-play" aria-hidden="true">▶</i>' : ""}
        </button>
        <span class="ct-row__main">
          <b>${isNew(e.created_at) ? '<i class="ct-new">N</i>' : ""}${esc(e.title)}</b>
          <small>by ${esc(e.nickname)} · ${ymd(e.created_at)}
            · <a href="${esc(e.sns_url)}" target="_blank" rel="noopener nofollow">${short && e.sns_post ? "계정" : short ? "영상·계정" : "SNS 원문"} ↗</a>
            ${short && e.sns_post ? `· <a href="${esc(e.sns_post)}" target="_blank" rel="noopener nofollow">영상 원문 ↗</a>` : ""}
            · <button type="button" data-view="proof">인증샷</button>
            · <button type="button" class="ct-report" data-report ${reported().has(e.id) ? "disabled" : ""}>${reported().has(e.id) ? "신고함" : "신고"}</button></small>
          ${e.story ? `<em>${esc(e.story)}</em>` : ""}
        </span>
        <span class="ct-row__count"><b>${e.vote_count.toLocaleString("ko-KR")}</b>표</span>
        <span class="ct-row__act"><button type="button" class="btn btn--sm ${voted ? "btn--ghost" : "btn--primary"}" data-vote ${off ? "disabled" : ""}>
          ${voted ? "투표함 ✓" : !open ? "마감" : user && left === 0 ? "표 소진" : "♥ 투표"}</button></span>
      </div>`;
    }).join("") + `</div>`;
  }

  /* ---------- 실시간 투표 현황 — 득표 TOP 10 가로 막대 ----------
     한 가지 값(득표)만 보여 주므로 색은 한 가지(#E0701F, 흰 바탕 대비 3:1 이상).
     막대 길이 = 1위 득표 대비 비율. 값·제목은 글자색으로 막대 옆에 직접 적고, 마우스를 올리면 자세히. */
  const chartBox = $("#ct-chart"), chartBars = $("#ct-chart-bars"), chartTip = $("#ct-chart-tip");
  let chartItems = [];
  function drawChart(items, sample) {
    if (!chartBox) return;
    const top = items.slice().sort((a, b) => b.votes - a.votes || (b.id || 0) - (a.id || 0)).slice(0, 10);
    if (!top.length) { chartBox.hidden = true; return; }
    const max = Math.max(1, top[0].votes), sum = items.reduce((s, x) => s + x.votes, 0) || 1;
    chartItems = top;
    $("#ct-chart-title").textContent = sample ? "실시간 투표 현황 (예시)" : "실시간 투표 현황";
    $("#ct-chart-sub").textContent = sample ? "응모작이 올라오면 실제 득표로 바뀝니다"
      : `${cat === "all" ? "전체" : CAT[cat]} · 총 ${sum.toLocaleString("ko-KR")}표 · 득표 상위 ${top.length}점`;
    chartBars.innerHTML = top.map((x, i) => {
      const w = x.votes / max * 100;
      return `<li class="ct-bar${i === 0 && x.votes > 0 ? " is-top" : ""}" data-i="${i}" tabindex="0"
          aria-label="${i + 1}위 ${esc(x.title)} ${x.votes}표">
        <span class="ct-bar__rank">${i + 1}</span>
        <span class="ct-bar__name">${x.category === "short" ? "🎬 " : ""}${esc(x.title)}</span>
        <span class="ct-bar__track"><i style="width:${Math.max(w, x.votes ? 2 : 0)}%"></i></span>
        <span class="ct-bar__val"><b>${x.votes.toLocaleString("ko-KR")}</b>표</span>
      </li>`;
    }).join("");
    chartBox.dataset.sum = sum;
    chartBox.hidden = false;
  }
  // 마우스·키보드로 막대에 올리면 자세히 (득표·전체 대비 비율)
  function showTip(li) {
    const x = chartItems[+li.dataset.i]; if (!x) return;
    const pct = (x.votes / (+chartBox.dataset.sum || 1) * 100).toFixed(1);
    chartTip.innerHTML = `<b>${esc(x.title)}</b><span>by ${esc(x.nickname)} · ${x.category === "short" ? "동영상" : "사진"}</span>
      <span><b>${x.votes.toLocaleString("ko-KR")}표</b> · 전체의 ${pct}%</span>`;
    const r = li.getBoundingClientRect(), b = chartBox.getBoundingClientRect();
    chartTip.style.top = (r.top - b.top - 6) + "px";
    chartTip.hidden = false;
  }
  if (chartBars) {
    chartBars.addEventListener("mouseover", (ev) => { const li = ev.target.closest(".ct-bar"); if (li) showTip(li); });
    chartBars.addEventListener("focusin", (ev) => { const li = ev.target.closest(".ct-bar"); if (li) showTip(li); });
    chartBars.addEventListener("mouseleave", () => (chartTip.hidden = true));
    chartBars.addEventListener("focusout", () => (chartTip.hidden = true));
  }

  /* ---------- 로그인·남은 표 표시 ---------- */
  async function loadMyVotes() {
    myVotes = new Set(); limitHit = false;
    if (!user) return;
    const { data } = await sb().from("contest_votes").select("entry_id").eq("user_id", user.id).eq("vote_day", kstToday());
    (data || []).forEach((r) => myVotes.add(r.entry_id));
  }

  function drawVotebar() {
    const bar = $("#ct-votebar");
    if (!open) {
      bar.innerHTML = `<p><b>투표 기간이 아닙니다.</b> 시민투표는 2026. 10. 9. ~ 12. 30. 에 열립니다. 발표 12. 31.(목) 14:00</p>`;
      return;
    }
    if (!user) {
      bar.innerHTML = `<p><b>투표하려면 로그인해 주세요.</b> 로그인하면 하루 ${DAILY}표를 쓸 수 있어요.</p>
        <div class="btn-row">
          <button type="button" class="btn btn--sm ct-kakao" data-login="kakao">카카오로 시작</button>
          <button type="button" class="btn btn--sm btn--ghost" data-login="google">구글로 시작</button>
          <a class="btn btn--sm btn--ghost" href="login.html">이메일 로그인</a>
        </div>`;
      return;
    }
    bar.innerHTML = `<p>오늘 남은 투표 <b class="ct-left">${leftOf()}</b> / ${DAILY}표 <span class="muted tiny">(사진·동영상 합산)</span>
      <span class="muted tiny">· 매일 0시(한국 시간)에 다시 채워져요</span></p>`;
  }

  /* ---------- 투표 ---------- */
  const VOTE_TEXT = {
    LOGIN: "로그인 후 투표할 수 있어요.",
    CLOSED: "지금은 투표 기간이 아닙니다.",
    NOENTRY: "투표할 수 없는 작품입니다. 새로고침해 주세요.",
    DUP: "이 작품에는 오늘 이미 투표했어요. 내일 다시 투표할 수 있어요.",
    LIMIT: `오늘 ${DAILY}표를 모두 쓰셨어요. 내일 다시 투표해 주세요!`,
  };

  async function vote(id, btn) {
    if (!user) { msg(boardMsg, "warn", VOTE_TEXT.LOGIN); $("#ct-votebar").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    btn.disabled = true;
    const { data, error } = await sb().rpc("contest_vote", { p_entry: id });
    if (error) { btn.disabled = false; msg(boardMsg, "err", "투표하지 못했습니다: " + error.message); return; }
    const r = (data && data[0]) || {};
    const e = entries.find((x) => x.id === id);
    if (e && r.entry_votes != null) e.vote_count = r.entry_votes;
    if (r.result === "OK" || r.result === "DUP") myVotes.add(id);
    if (r.result === "LIMIT") limitHit = true;
    if (r.result === "OK") msg(boardMsg, "ok", `투표했어요! 오늘 남은 투표 ${r.votes_left}표`);
    else msg(boardMsg, r.result === "DUP" ? "warn" : "err", VOTE_TEXT[r.result] || "투표하지 못했습니다.");
    draw(); drawVotebar();
  }

  /* ---------- 신고 — 서로 다른 5명이 신고하면 서버가 자동으로 숨기고 관리자가 확인 ---------- */
  const REP_KEY = "yongma_contest_reported";
  function reported() { try { return new Set(JSON.parse(localStorage.getItem(REP_KEY)) || []); } catch (e) { return new Set(); } }
  function markReported(id) { try { const s = reported(); s.add(id); localStorage.setItem(REP_KEY, JSON.stringify([...s])); } catch (e) { /* 무시 */ } }

  async function report(e) {
    const reason = prompt(`「${e.title}」을(를) 신고하는 이유를 적어 주세요.\n(예: 다른 사람 사진 도용, 선정적·폭력적 내용, 행사와 무관 등)`);
    if (reason === null) return;                                  // 취소
    const { data, error } = await sb().rpc("contest_report", { p_entry: e.id, p_reason: reason.trim() });
    if (error) return msg(boardMsg, "err", "신고하지 못했습니다: " + error.message);
    markReported(e.id);
    if (data === "HIDDEN") {
      entries = entries.filter((x) => x.id !== e.id);
      msg(boardMsg, "ok", "신고가 접수되었습니다. 신고가 누적되어 관리자 확인 전까지 숨김 처리했습니다.");
    } else {
      msg(boardMsg, data === "DUP" ? "warn" : "ok", data === "DUP" ? "이미 신고한 작품입니다." : "신고가 접수되었습니다. 관리자가 확인하겠습니다.");
    }
    draw();
  }

  /* ---------- 크게 보기 / 영상 재생 ---------- */
  const lb = $("#ct-lb"), lbImg = $("#ct-lb-img"), lbVid = $("#ct-lb-video");
  function view(e, which) {
    const vurl = e.sns_post || e.sns_url;                                // 영상 링크(없으면 계정 주소)
    const yt = which === "photo" && e.category === "short" && embedOf(vurl);
    if (which === "photo" && e.category === "short" && !yt) {     // 재생 주소를 못 만든 경우(단축 링크 등)는 원문에서
      window.open(vurl, "_blank", "noopener");
      return;
    }
    lbVid.innerHTML = yt
      ? `<iframe src="${yt.src}" title="${esc(e.title)}" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen loading="lazy"></iframe>
         <a class="ct-video__orig" href="${esc(vurl)}" target="_blank" rel="noopener nofollow">원문에서 보기 ↗</a>`
      : "";
    lbVid.dataset.kind = yt ? yt.kind : "";
    lbVid.hidden = !yt; lbImg.hidden = !!yt;
    if (!yt) {
      lbImg.src = pub(which === "proof" ? e.proof_path : e.photo_path);
      lbImg.alt = which === "proof" ? `${e.title} SNS 인증샷` : e.title;
    }
    $("#ct-lb-cap").textContent = which === "proof" ? `SNS 인증샷 — ${e.title}` : e.title;
    $("#ct-lb-meta").textContent = `${CAT[e.category]} 부문 · by ${e.nickname} · ${e.vote_count}표`;
    lb.showModal();
  }
  const closeLb = () => { lb.close(); lbVid.innerHTML = ""; };     // 닫으면 영상도 멈춘다
  $("#ct-lb-close").onclick = closeLb;
  lb.addEventListener("click", (ev) => { if (ev.target === lb) closeLb(); });
  lb.addEventListener("close", () => (lbVid.innerHTML = ""));

  grid.addEventListener("click", (ev) => {
    const card = ev.target.closest(".ct-row[data-id]");
    if (!card) return;
    const e = entries.find((x) => String(x.id) === card.dataset.id);
    if (!e) return;
    const v = ev.target.closest("[data-view]");
    if (v) return view(e, v.dataset.view);
    if (ev.target.closest("[data-report]")) return report(e);
    const b = ev.target.closest("[data-vote]");
    if (b) vote(e.id, b);
  });

  document.querySelector(".ct-sort").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-sort]");
    if (!b) return;
    sort = b.dataset.sort;
    document.querySelectorAll(".ct-sort button").forEach((x) => x.classList.toggle("active", x === b));
    draw();
  });

  document.querySelector(".ct-cat").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-cat]");
    if (!b) return;
    cat = b.dataset.cat;
    clear(boardMsg);
    draw();
  });

  $("#ct-votebar").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-login]");
    if (!b) return;
    try { await Auth.signInWithProvider(b.dataset.login); }       // 로그인 후 이 페이지로 돌아온다
    catch (err) {
      msg(boardMsg, "err", err.message === "PROVIDER_OFF" ? "지금은 이 방법으로 로그인할 수 없습니다. 이메일 로그인을 이용해 주세요." : err.message);
    }
  });

  /* ======================================================================
     응모
     ====================================================================== */
  const form = $("#ct-form"), formMsg = $("#ct-form-msg");

  // 부문을 고르면 칸 이름·안내가 바뀐다 (동영상은 영상 파일 대신 링크 + 대표 화면 캡처)
  const FORM_TEXT = {
    photo: { url: "내 SNS 게시물 주소", ph: "https://www.instagram.com/p/...", pic: "응모 사진", pick: "사진 고르기", note: "JPG·PNG 사진, 30MB 이하" },
    short: { url: "내 SNS 영상 주소 (유튜브·인스타 릴스·틱톡 등)", ph: "https://youtube.com/shorts/...", pic: "영상 대표 화면 (캡처)", pick: "대표 화면 고르기", note: "게시판에 보일 장면을 캡처해 주세요" },
  };
  const formCat = () => (form.querySelector("input[name=f-cat]:checked") || {}).value || "photo";
  function paintFormCat() {
    const t = FORM_TEXT[formCat()];
    $("#f-url-label").textContent = t.url;
    $("#f-url").placeholder = t.ph;
    $("#f-photo-label").textContent = t.pic;
    if (!$("#drop-photo").classList.contains("has")) $("#drop-photo span").textContent = t.pick;
    $("#drop-photo small").textContent = t.note;
    $("#f-short-note").hidden = formCat() !== "short";
    $("#f-url-box").hidden = formCat() === "short";
    $("#f-acct-box").hidden = formCat() !== "short";
    paintPlat();
  }

  /* 동영상 — 플랫폼별 기본 주소. 아이디만 넣으면 계정 주소가 만들어진다 */
  const PLAT = {
    youtube:   { pre: "youtube.com/@",   base: "https://www.youtube.com/@",   post: "https://youtube.com/shorts/..." },
    instagram: { pre: "instagram.com/",  base: "https://www.instagram.com/",  post: "https://www.instagram.com/reel/..." },
    tiktok:    { pre: "tiktok.com/@",    base: "https://www.tiktok.com/@",    post: "https://www.tiktok.com/@아이디/video/..." },
    etc:       { pre: "https://",        base: "https://",                    post: "https://..." },
  };
  const plat = () => (form.querySelector("input[name=f-plat]:checked") || {}).value || "youtube";
  function paintPlat() {
    const k = plat();
    $("#f-acct-pre").textContent = PLAT[k].pre;
    $("#f-acct").placeholder = k === "etc" ? "계정 주소 (예: blog.naver.com/아이디)" : "내 아이디";
    $("#f-post").placeholder = PLAT[k].post;
  }
  /* 아이디 정리 — 앞의 @, 통째로 붙여 넣은 주소에서 아이디만 꺼낸다 */
  function cleanId(v, k) {
    v = String(v || "").trim();
    if (k === "etc") return v.replace(/^https?:\/\//i, "");
    const m = v.match(/(?:youtube\.com\/@?|instagram\.com\/|tiktok\.com\/@?)([\w.\-가-힣]+)/i);
    if (m) v = m[1];
    return v.replace(/^@+/, "").replace(/[/?#].*$/, "");
  }
  form.addEventListener("change", (ev) => { if (ev.target.name === "f-cat") paintFormCat(); if (ev.target.name === "f-plat") paintPlat(); });
  if (/#enter-short/.test(location.hash)) { form.querySelector("input[value=short]").checked = true; }
  paintFormCat();

  // 고른 사진 미리 보기
  ["photo", "proof"].forEach((k) => {
    const input = $(`#f-${k}`), box = $(`#drop-${k}`);
    input.addEventListener("change", () => {
      const f = input.files[0];
      const img = box.querySelector("img");
      if (!f) { img.hidden = true; box.classList.remove("has"); return; }
      img.src = URL.createObjectURL(f);
      img.hidden = false;
      box.classList.add("has");
      box.querySelector("span").textContent = f.name;
    });
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clear(formMsg);
    const c = sb();
    if (!c) return msg(formMsg, "err", "지금은 응모를 받을 수 없습니다. 잠시 후 다시 시도해 주세요.");
    if ($("#f-website").value) return;                                  // 자동 등록기

    const title = $("#f-title").value.trim(), nick = $("#f-nick").value.trim();
    const story = $("#f-story").value.trim();
    let url = $("#f-url").value.trim(), post = "";
    const photo = $("#f-photo").files[0], proof = $("#f-proof").files[0];
    if (!open) return msg(formMsg, "err", "응모 기간(2026. 10. 9. ~ 12. 30.)이 아닙니다.");
    if (!title || !nick) return msg(formMsg, "err", "작품 제목과 닉네임을 적어 주세요.");
    const category = formCat();
    if (category === "short") {
      const k = plat(), id = cleanId($("#f-acct").value, k);
      if (!id) return msg(formMsg, "err", "영상을 올린 SNS 아이디를 적어 주세요.");
      url = PLAT[k].base + id;
      post = $("#f-post").value.trim();
      if (post && !/^https?:\/\/\S+\.\S+/i.test(post)) return msg(formMsg, "err", "영상 링크는 https:// 로 시작하는 주소로 붙여 넣어 주세요. (비워 두어도 됩니다)");
    } else if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
      return msg(formMsg, "err", "SNS 게시물 주소를 https:// 로 시작하는 링크로 붙여 넣어 주세요.");
    }
    if (!photo || !proof) return msg(formMsg, "err", `${FORM_TEXT[category].pic}과 SNS 인증샷을 모두 골라 주세요.`);
    if (![photo, proof].every((f) => /^image\//.test(f.type) && f.size <= MAX_SRC)) return msg(formMsg, "err", "사진 파일(30MB 이하)만 올릴 수 있어요.");
    if (!$("#f-a1").checked || !$("#f-a2").checked) return msg(formMsg, "err", "필수 동의 두 가지에 체크해 주세요.");

    const btn = $("#f-submit");
    btn.disabled = true; btn.textContent = "사진 올리는 중…";
    try {
      const [big, thumb, prf] = await Promise.all([shrink(photo, BIG, .85), shrink(photo, THUMB, .8), shrink(proof, PROOF, .85)]);
      const base = `entries/${kstToday().replace(/-/g, "")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const paths = { photo_path: `${base}.webp`, photo_thumb: `${base}_t.webp`, proof_path: `${base}_proof.webp` };
      const put = (p, b) => c.storage.from(BUCKET).upload(p, b, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      const ups = await Promise.all([put(paths.photo_path, big.blob), put(paths.photo_thumb, thumb.blob), put(paths.proof_path, prf.blob)]);
      const bad = ups.find((u) => u.error);
      if (bad) throw bad.error;

      // 등록은 서버 함수 contest_submit 이 한다 (검사 + 등록 + 지우기 열쇠 저장 → 번호)
      const key = newKey();
      const args = { p_category: category, p_title: title, p_nickname: nick, p_sns_url: url, p_story: story,
        p_photo: paths.photo_path, p_thumb: paths.photo_thumb, p_proof: paths.proof_path, p_w: big.w, p_h: big.h, p_key: key };
      let { data: newId, error } = await c.rpc("contest_submit", { ...args, p_post: post });
      if (error && /PGRST202|Could not find the function/.test(error.code + error.message)) {   // SQL 실행 전 호환 — 영상 링크를 주소로
        ({ data: newId, error } = await c.rpc("contest_submit", { ...args, p_sns_url: post || url }));
      }
      if (error) {
        await c.storage.from(BUCKET).remove(Object.values(paths));         // 등록 실패 → 올린 파일 치우기
        throw new Error(/CLOSED/.test(error.message) ? "응모가 마감되었습니다." : /DAILY_LIMIT/.test(error.message) ? "오늘은 30점까지 응모할 수 있어요. 내일 다시 응모해 주세요!" : error.message);
      }
      const m = mine();
      m[newId] = { key, title, cat: category, thumb: paths.photo_thumb, at: kstToday() };
      saveMine(m);

      form.reset();
      form.querySelector(`input[value=${category}]`).checked = true;      // 같은 부문으로 이어서 응모하기 쉽게
      document.querySelectorAll(".ct-drop").forEach((b) => { b.classList.remove("has"); b.querySelector("img").hidden = true; });
      $("#drop-proof span").textContent = "캡처 고르기";
      paintFormCat();
      msg(formMsg, "ok", "응모 완료! 게시판과 메인에 바로 올라갔어요. 친구들에게 투표를 부탁해 보세요.");
      await loadEntries(); draw(); drawMine();
    } catch (err) {
      msg(formMsg, "err", "응모하지 못했습니다: " + (err.message || err));
    } finally {
      btn.disabled = false; btn.textContent = "응모하기";
    }
  });

  /* ---------- 내 응모작 (이 브라우저) ---------- */
  function drawMine() {
    const box = $("#ct-mine");
    const m = mine(), ids = Object.keys(m);
    if (!ids.length || !sb()) { box.innerHTML = ""; return; }
    const shown = new Set(entries.map((e) => String(e.id)));
    box.innerHTML = `<div class="ct-mine"><h3>내가 응모한 작품 <span class="muted tiny">(이 기기에서 응모한 것만 보여요)</span></h3>
      <ul>${ids.map((id) => `<li>
        <img src="${pub(m[id].thumb)}" alt="" loading="lazy">
        <div><b>${esc(m[id].title)}</b><span class="tiny muted">${CAT[m[id].cat] || "사진"} 부문 · ${shown.has(id) ? "게시 중" : "숨김(관리자 확인 중) 또는 반려"} · ${esc(m[id].at)}</span></div>
        <button type="button" class="btn btn--ghost btn--sm" data-del="${id}">응모 취소</button>
      </li>`).join("")}</ul></div>`;
  }

  $("#ct-mine").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-del]");
    if (!b || !confirm("이 응모를 취소할까요? 받은 투표도 함께 사라집니다.")) return;
    const id = b.dataset.del, m = mine();
    const { data, error } = await sb().rpc("contest_delete", { p_id: +id, p_key: m[id]?.key });
    if (error) return alert("취소하지 못했습니다: " + error.message);
    const r = data && data[0];
    if (r) await sb().storage.from(BUCKET).remove([r.photo_path, r.photo_thumb, r.proof_path]);
    delete m[id]; saveMine(m);
    entries = entries.filter((e) => String(e.id) !== id);
    draw(); drawMine();
  });

  /* ---------- 시작 ---------- */
  (async () => {
    period();
    if (!sb()) { grid.innerHTML = '<p class="ct-empty">사진전 게시판을 준비하고 있습니다.</p>'; return; }
    user = await Auth.user();
    await Promise.all([loadEntries(), loadMyVotes()]);
    draw(); drawVotebar(); drawMine();
    // 실시간 — 다른 사람이 투표·응모하면 게시판과 투표 현황 그래프가 바로 바뀐다
    let rt = null;
    try {
      sb().channel("contest-board")
        .on("postgres_changes", { event: "*", schema: "public", table: "contest_entries" }, () => {
          clearTimeout(rt); rt = setTimeout(async () => { await loadEntries(); draw(); }, 800);
        }).subscribe();
    } catch (e) { /* 실시간을 못 써도 페이지는 동작 */ }
    sb().auth.onAuthStateChange(async (_e, s) => {                   // 다른 탭에서 로그인·로그아웃
      const u = s?.user || null;
      if ((u && u.id) === (user && user.id)) return;
      user = u; await loadMyVotes(); draw(); drawVotebar();
    });
  })();
})();
