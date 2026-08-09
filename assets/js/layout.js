/* ==========================================================================
   공통 헤더 / 푸터 — 한 곳에서만 고치면 모든 페이지에 반영됩니다.
   페이지에는 <div id="site-header"></div> / <div id="site-footer"></div> 만 두면 됩니다.
   ========================================================================== */

const NAV = [
  ["index.html",    "홈",        "nav.home"],
  ["about.html",    "상권 소개", "nav.about"],
  ["zones.html",    "6개 존",    "nav.zones"],
  ["programs.html", "프로그램",  "nav.programs"],
  ["food.html",     "미식 지도", "nav.food"],
  ["news.html",     "소식",      "nav.news"],
  ["join.html",     "참여 신청", "nav.join"],
];

(function renderLayout() {
  const B = document.documentElement.dataset.base || "";
  const links = (cls) =>
    NAV.map(([href, label, key]) =>
      `<li><a href="${B}${href}" data-i18n="${key}">${label}</a></li>`
    ).join("");

  const header = document.getElementById("site-header");
  if (header) {
    header.outerHTML = `
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${B}index.html">
      <img src="${B}assets/img/mascot-yong.webp" alt="">
      <span>용마미식거리<small>GANGNEUNG 2026</small></span>
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
          <li><a href="${B}about.html">상권 소개</a></li>
          <li><a href="${B}zones.html">6개 존</a></li>
          <li><a href="${B}programs.html">프로그램·일정</a></li>
          <li><a href="${B}food.html">미식 지도</a></li>
          <li><a href="${B}join.html">참여 신청</a></li>
        </ul>
      </div>
      <div>
        <h4>사업 추진</h4>
        <ul class="stack" style="gap:8px">
          <li>상권기획자 (주)에스티엔미디어</li>
          <li>상인조직 포남용마거리 골목형상점가 상인회</li>
          <li>협업기관 강원영동이벤트</li>
          <li>강릉시 · 강원특별자치도</li>
        </ul>
      </div>
      <div>
        <h4>문의</h4>
        <ul class="stack" style="gap:8px">
          <li>강릉시 경강로 2258 3층<br>(상인회 사무실)</li>
          <li><a href="${B}news.html">공지사항</a></li>
          <li><a href="${B}login.html">회원 로그인</a></li>
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
