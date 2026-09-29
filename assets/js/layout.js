/* ==========================================================================
   공통 헤더 / 푸터 — 한 곳에서만 고치면 모든 페이지에 반영됩니다.
   페이지에는 <div id="site-header"></div> / <div id="site-footer"></div> 만 두면 됩니다.
   ========================================================================== */

const NAV = [
  ["index.html",    "홈",        "nav.home"],
  ["story.html",    "용마거리 소개", "nav.story"],
  ["about.html",    "상권 소개", "nav.about"],
  ["zones.html",    "6개 존",    "nav.zones"],
  ["programs.html", "프로그램",  "nav.programs"],
  ["food.html",     "미식 지도", "nav.food"],
  ["booths.html",   "매대 명단", "nav.booths"],
  ["gallery.html",  "갤러리",    "nav.gallery"],
  ["news.html",     "소식",      "nav.news"],
  ["join.html",     "참여 신청", "nav.join"],
];

/* 구글 번역 — 기본 한국어, 국기 버튼으로 영어·중국어·일본어 자동 번역.
   고른 언어는 googtrans 쿠키에 남아 다른 페이지로 옮겨 가도 유지된다. */
const LANGS = [
  ["ko",    "kr", "한국어"],
  ["en",    "us", "English"],
  ["zh-CN", "cn", "中文"],
  ["ja",    "jp", "日本語"],
];

function currentLang() {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/ko\/([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "ko";
}

function setLang(code) {
  const host = location.hostname;
  const kill = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  // 쿠키는 주소 단위·도메인 단위 두 가지로 남을 수 있어 둘 다 정리한 뒤 새로 쓴다
  document.cookie = `googtrans=; ${kill}`;
  document.cookie = `googtrans=; ${kill}; domain=${host}`;
  document.cookie = `googtrans=; ${kill}; domain=.${host.replace(/^www\./, "")}`;
  if (code !== "ko") {
    document.cookie = `googtrans=/ko/${code}; path=/`;
    document.cookie = `googtrans=/ko/${code}; path=/; domain=.${host.replace(/^www\./, "")}`;
  }
  location.reload();
}

window.googleTranslateElementInit = function () {
  new google.translate.TranslateElement(
    { pageLanguage: "ko", includedLanguages: "en,zh-CN,ja", autoDisplay: false },
    "google_translate_element"
  );
};

(function renderLayout() {
  const B = document.documentElement.dataset.base || "";
  // 상단 메뉴는 기계 번역 대신 직접 옮긴 이름을 쓴다(짧고 정확하게, 메뉴가 한 줄에 들어가도록)
  const NAV_T = {
    en:      ["Home", "Yongma Story", "District", "6 Zones", "Programs", "Food Map", "Booths", "Gallery", "News", "Join"],
    "zh-CN": ["首页", "龙马街介绍", "商圈介绍", "六大区域", "活动项目", "美食地图", "摊位名单", "相册", "新闻", "参与申请"],
    ja:      ["ホーム", "龍馬の由来", "商店街", "6ゾーン", "プログラム", "グルメ地図", "屋台一覧", "ギャラリー", "ニュース", "参加申込"],
  };
  const lang = currentLang();
  const links = (cls) =>
    NAV.map(([href, label, key], i) =>
      `<li><a href="${B}${href}"${lang === "ko" ? ` data-i18n="${key}"` : ""} class="notranslate" translate="no">${(NAV_T[lang] || [])[i] || label}</a></li>`
    ).join("");

  const header = document.getElementById("site-header");
  if (header) {
    header.outerHTML = `
<div class="lang-bar notranslate" translate="no">
  <div class="wrap">
    <span class="lang-bar__label">Language</span>
    ${LANGS.map(([code, flag, label]) =>
      `<button type="button" class="lang-btn" data-lang="${code}" title="${label}" aria-label="${label}">
        <img src="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/${flag}.svg" alt="" width="20" height="15"><span>${label}</span>
      </button>`).join("")}
  </div>
</div>
<div id="google_translate_element" hidden></div>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${B}index.html">
      <img src="${B}assets/img/mascot-yong.webp" alt="">
      <span class="notranslate" translate="no">용마미식거리<small>GANGNEUNG 2026</small></span>
    </a>
    <nav class="nav" aria-label="주 메뉴"><ul>${links()}</ul></nav>
    <div class="header-actions">
      <div data-lang-switcher hidden></div>
      <div data-auth-box style="display:flex;gap:8px"></div>
      <button class="nav-toggle" aria-label="메뉴 열기" aria-controls="mnav" aria-expanded="false"><span></span></button>
    </div>
  </div>
</header>
<div class="mobile-nav" id="mnav"><div class="wrap"><ul>${links()}</ul></div></div>`;

    // 국기 버튼 — 지금 언어 표시 + 누르면 전환
    const now = currentLang();
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === now);
      b.setAttribute("aria-pressed", b.dataset.lang === now);
      b.addEventListener("click", () => { if (b.dataset.lang !== currentLang()) setLang(b.dataset.lang); });
    });
    // 로그인 영역 버튼도 기계 번역 대신 짧은 이름으로 (영어 'join the membership' 처럼 길어져 메뉴가 밀리지 않게)
    const AUTH_T = {
      en:      { "로그인": "Log in", "회원가입": "Sign up", "로그아웃": "Log out", "마이페이지": "My page", "관리자": "Admin" },
      "zh-CN": { "로그인": "登录", "회원가입": "注册", "로그아웃": "退出", "마이페이지": "我的", "관리자": "管理" },
      ja:      { "로그인": "ログイン", "회원가입": "会員登録", "로그아웃": "ログアウト", "마이페이지": "マイページ", "관리자": "管理" },
    };
    const authBox = document.querySelector("[data-auth-box]");
    if (authBox && AUTH_T[lang]) {
      authBox.classList.add("notranslate");
      authBox.setAttribute("translate", "no");
      const relabel = () => authBox.querySelectorAll("a, button").forEach((el) => {
        const t = AUTH_T[lang][el.textContent.trim()];
        if (t) el.textContent = t;
      });
      relabel();
      new MutationObserver(relabel).observe(authBox, { childList: true, subtree: true });
    }

    // 메뉴가 한 줄에 다 안 들어가면(긴 외국어 메뉴·화면 확대 등) 메뉴 버튼(☰)으로 접는다 — 로고가 잘리지 않게
    let needed = 0;                                  // 메뉴를 펼쳤을 때 필요한 폭(펼쳐져 있을 때만 잴 수 있다)
    const fitNav = () => {
      const root = document.documentElement, nav = document.querySelector(".nav");
      if (!nav) return;
      if (!matchMedia("(min-width: 1260px)").matches) { root.classList.remove("nav-compact"); return; }  // 좁은 화면은 원래 접힘
      const ul = nav.querySelector("ul");
      if (!root.classList.contains("nav-compact") && ul.scrollWidth > 0) needed = ul.scrollWidth;
      const wrap = nav.parentElement, brand = wrap.querySelector(".brand"), acts = wrap.querySelector(".header-actions");
      const room = wrap.clientWidth - brand.offsetWidth - acts.offsetWidth - 44;   // 로고·버튼 사이 여백 포함
      root.classList.toggle("nav-compact", needed > room);
    };
    fitNav();
    window.addEventListener("resize", fitNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
    // 글꼴을 늦게 불러오면 메뉴 폭이 나중에 바뀐다 — 항목 폭이 변할 때마다 다시 잰다
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => fitNav());
      document.querySelectorAll(".nav li, .header-actions, .brand").forEach((el) => ro.observe(el));   // 로그인 버튼이 번역돼 길어져도 다시 잰다
    }

    // 번역 엔진은 한국어가 아닐 때만 불러온다 (한국어 방문자는 가볍게)
    if (now !== "ko") {
      const s = document.createElement("script");
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.head.appendChild(s);
    }
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.outerHTML = `
<footer class="site-footer">
  <div class="wrap">
    <div class="grid grid-4">
      <div>
        <div class="foot-brand"><img src="${B}assets/img/mascot-yong.webp" alt="">용마미식거리</div>
        <p>강릉의 밤을 물들이는<br>예술·미식·문화 야간 골목상권</p>
        <p class="tiny mt-2" style="color:rgba(255,255,255,.4)">2026 지역상권 육성사업<br>(유망골목상권)</p>
      </div>
      <div>
        <h4>바로가기</h4>
        <ul class="stack" style="gap:8px">
          <li><a href="${B}story.html">용마거리 소개</a></li>
          <li><a href="${B}about.html">상권 소개</a></li>
          <li><a href="${B}zones.html">6개 존</a></li>
          <li><a href="${B}programs.html">프로그램·일정</a></li>
          <li><a href="${B}food.html">미식 지도</a></li>
          <li><a href="${B}booths.html">매대 명단</a></li>
          <li><a href="${B}gallery.html">갤러리</a></li>
          <li><a href="${B}join.html">참여 신청</a></li>
        </ul>
      </div>
      <div>
        <h4>주최 · 주관</h4>
        <ul class="stack" style="gap:8px">
          <li>주최 강원지방중소벤처기업청</li>
          <li>주최 소상공인시장진흥공단</li>
          <li>주최 강원특별자치도 · 강릉시</li>
          <li>주관 STN미디어</li>
          <li>주관 포남용마거리 골목형상점가 상인회</li>
        </ul>
      </div>
      <div>
        <h4>문의</h4>
        <ul class="stack" style="gap:8px">
          <li>강릉시 경강로 2258 3층<br>(상인회 사무실)</li>
          <li><a href="${B}news.html">공지사항</a></li>
          <li><a href="${B}login.html">회원 로그인</a></li>
          <li><a href="https://stn6000.com/yongma/admin" rel="nofollow">관리자</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© <span data-year>2026</span> 용마미식거리 · 포남용마거리 골목형상점가 상인회</span>
      <span>(주)에스티엔미디어 114-87-25596 · 2026yongma.com</span>
    </div>
  </div>
</footer>`;
  }
})();
