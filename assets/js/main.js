/* ==========================================================================
   공통 스크립트 — 내비게이션 / 스크롤 리빌 / 카운트업 / 연도
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ----- 모바일 내비 ----- */
  const toggle = document.querySelector(".nav-toggle");
  const mnav = document.querySelector(".mobile-nav");
  if (toggle && mnav) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const open = mnav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    mnav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        mnav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ----- 현재 메뉴 표시 ----- */
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a, .mobile-nav a").forEach((a) => {
    if ((a.getAttribute("href") || "").split("/").pop() === here) {
      a.setAttribute("aria-current", "page");
    }
  });

  /* ----- 연도 ----- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ----- 스크롤 리빌 ----- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (!("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e, i) => {
            if (!e.isIntersecting) return;
            setTimeout(() => e.target.classList.add("in"), (i % 4) * 70);
            io.unobserve(e.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
      );
      reveals.forEach((el) => io.observe(el));
    }
  }

  /* ----- 숫자 카운트업 : <b data-count="3323" data-suffix="만명"> ----- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const fmt = (n) => n.toLocaleString("ko-KR");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const end = parseFloat(el.dataset.count);
          const dec = (el.dataset.count.split(".")[1] || "").length;
          const dur = 1100;
          const t0 = performance.now();
          const step = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            const v = end * (1 - Math.pow(1 - p, 3));
            el.textContent = dec ? v.toFixed(dec) : fmt(Math.round(v));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          io.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => io.observe(el));
  }

  /* ----- 부트스트랩 ----- */
  if (window.I18N) I18N.init();
  if (window.Auth) Auth.paintHeader();
});

/* ---------- 앱으로 설치 (PWA) ----------
   · 서비스워커(/sw.js)를 등록해야 크롬·삼성인터넷이 "앱 설치" 를 허용한다.
   · 설치가 가능해지면 화면 왼쪽 아래에 [앱 설치] 버튼을 띄운다.
   · 아이폰 사파리는 설치 창을 띄울 수 없어 "공유 → 홈 화면에 추가" 안내를 보여 준다.
   · 닫기를 누르면 7일 동안 다시 띄우지 않는다. 관리자 화면에서는 띄우지 않는다. */
(() => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* 등록 실패해도 사이트는 그대로 */ }));
  }
  if (location.pathname.indexOf("/admin/") === 0) return;

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;                                  // 이미 앱으로 열었으면 버튼 불필요

  const HIDE_KEY = "yongma_install_hide_until";
  try { if (Date.now() < +localStorage.getItem(HIDE_KEY)) return; } catch (e) { /* 저장소 못 써도 진행 */ }

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  let deferred = null;

  function show(onClick) {
    if (document.querySelector(".pwa-install")) return;
    const box = document.createElement("div");
    box.className = "pwa-install";
    box.innerHTML =
      '<button type="button" class="pwa-install__go"><img src="/assets/icons/favicon-32.png" alt="" width="20" height="20">앱 설치</button>' +
      '<button type="button" class="pwa-install__x" aria-label="닫기">×</button>';
    box.querySelector(".pwa-install__go").addEventListener("click", onClick);
    box.querySelector(".pwa-install__x").addEventListener("click", () => {
      try { localStorage.setItem(HIDE_KEY, String(Date.now() + 7 * 86400000)); } catch (e) { /* 무시 */ }
      box.remove();
    });
    document.body.appendChild(box);
  }

  window.addEventListener("beforeinstallprompt", (e) => {   // 안드로이드·PC 크롬/엣지/삼성인터넷
    e.preventDefault();
    deferred = e;
    show(async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      document.querySelector(".pwa-install")?.remove();
    });
  });
  window.addEventListener("appinstalled", () => document.querySelector(".pwa-install")?.remove());

  if (ios) {                                                // 아이폰·아이패드 사파리
    window.addEventListener("load", () => show(() => {
      const box = document.querySelector(".pwa-install");
      if (box && !box.querySelector(".pwa-install__tip")) {
        box.insertAdjacentHTML("afterbegin",
          '<p class="pwa-install__tip">화면 아래 <b>공유</b> 버튼(□↑)을 누른 뒤 <b>홈 화면에 추가</b>를 고르세요.</p>');
      }
    }));
  }
})();

/* ---------- 유틸 ---------- */
window.UI = {
  alert(el, type, msg) {
    if (!el) return;
    el.className = `alert alert--${type} show`;
    el.textContent = msg;
  },
  clearAlert(el) {
    if (el) el.className = "alert";
  },
  money(n) {
    return (n ?? 0).toLocaleString("ko-KR");
  },
  date(s) {
    if (!s) return "-";
    const d = new Date(s);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  },
};
