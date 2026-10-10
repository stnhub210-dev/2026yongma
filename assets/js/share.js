/* 공유하기 — [data-share] 버튼을 누르면 https://2026yongma.com 을 카카오톡으로 보낸다.
   1) config.js 에 SITE.kakaoJsKey(카카오 개발자 JavaScript 키)가 있으면 → 카카오톡 공유 창(미리보기 카드)
   2) 키가 없으면 → 휴대폰 공유 창(카카오톡 선택 가능, navigator.share)
   3) 그것도 안 되면(PC) → 주소를 복사하고 안내 */
(function () {
  "use strict";
  const URL_ = "https://2026yongma.com";
  const TITLE = "용마미식거리";
  const DESC = "KTX강릉역에서 600M. 40년 역사의 골목이 매주 금.토 운영 2026.10.09~11.14 오후5시부터";
  const IMG = "https://2026yongma.com/assets/img/og-kakao.jpg?v=20261009";
  const KEY = (window.SITE && SITE.kakaoJsKey) || "";

  let sdk = null;
  function loadKakao() {
    if (sdk) return sdk;
    sdk = new Promise((ok, no) => {
      if (window.Kakao) return ok(window.Kakao);
      const s = document.createElement("script");
      s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
      s.crossOrigin = "anonymous";
      s.onload = () => ok(window.Kakao);
      s.onerror = no;
      document.head.appendChild(s);
    }).then((K) => { if (!K.isInitialized()) K.init(KEY); return K; });
    return sdk;
  }

  function say(btn, text) {
    const m = btn.parentElement.querySelector(".share-msg");
    if (!m) return;
    m.textContent = text;
    clearTimeout(m._t); m._t = setTimeout(() => (m.textContent = ""), 4000);
  }

  async function copy(btn) {
    try { await navigator.clipboard.writeText(URL_); say(btn, "주소를 복사했어요! PC 카카오톡 대화창에 붙여 넣기(Ctrl+V) 하세요."); }
    catch (e) { prompt("아래 주소를 복사해 카카오톡으로 보내 주세요.", URL_); }
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-share]");
    if (!btn) return;
    if (KEY) {
      try {
        const K = await loadKakao();
        K.Share.sendDefault({
          objectType: "feed",
          content: { title: TITLE, description: DESC, imageUrl: IMG, link: { mobileWebUrl: URL_, webUrl: URL_ } },
          buttons: [{ title: "홈페이지 보기", link: { mobileWebUrl: URL_, webUrl: URL_ } }],
        });
        return;
      } catch (err) { console.warn("카카오 공유 실패 — 다른 방법으로", err); }
    }
    // 휴대폰에서만 공유 창(카카오톡 선택). PC(윈도우)의 공유 창은 카카오톡이 없고 실패가 잦아 주소 복사로
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    if (mobile && navigator.share) {
      try { await navigator.share({ title: TITLE, text: DESC, url: URL_ }); return; }
      catch (err) { if (err && err.name === "AbortError") return; }
    }
    copy(btn);
  });
})();
