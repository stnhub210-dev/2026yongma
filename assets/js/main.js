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
