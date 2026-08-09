/* ==========================================================================
   경량 i18n 엔진
   --------------------------------------------------------------------------
   사용법 : <h1 data-i18n="home.hero.title">기본(한국어) 문구</h1>
            <input data-i18n-attr="placeholder:form.email.ph">
   원칙   : HTML 안의 글자는 "한국어 기본값"으로 그대로 두고,
            번역 파일이 있으면 덮어쓰는 방식.
            → 지금은 ko 하나만 있어도 사이트가 100% 정상 동작하고,
              나중에 en/zh/ja.json 만 얹으면 다국어가 켜집니다.
   ========================================================================== */

const I18N = {
  lang: "ko",
  dict: {},
  base: "",

  async init() {
    // 하위 폴더(admin/)에서도 경로가 맞도록 기준 경로 계산
    this.base = document.documentElement.dataset.base || "";

    const saved = localStorage.getItem("ym_lang");
    const enabled = SITE.i18n.enabled;
    const browser = (navigator.language || "ko").slice(0, 2);
    this.lang = enabled.includes(saved) ? saved
              : enabled.includes(browser) ? browser
              : SITE.i18n.default;

    await this.load(this.lang);
    this.apply();
    this.mountSwitcher();
  },

  async load(lang) {
    try {
      const res = await fetch(`${this.base}assets/i18n/${lang}.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      this.dict = await res.json();
    } catch (e) {
      // 번역 파일이 없거나 실패해도 HTML 기본 문구(한국어)로 정상 표시됨
      this.dict = {};
    }
    document.documentElement.lang = lang;
  },

  get(key) {
    return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), this.dict);
  },

  apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = this.get(el.dataset.i18n);
      if (typeof v === "string") el.textContent = v;
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const v = this.get(el.dataset.i18nHtml);
      if (typeof v === "string") el.innerHTML = v;
    });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(",").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        const v = this.get(key);
        if (typeof v === "string") el.setAttribute(attr, v);
      });
    });
    const t = this.get("meta.title");
    if (t) document.title = t;
  },

  async set(lang) {
    if (!SITE.i18n.enabled.includes(lang)) return;
    localStorage.setItem("ym_lang", lang);
    location.reload();
  },

  /* 사용 가능한 언어가 2개 이상일 때만 선택기를 노출 */
  mountSwitcher() {
    const host = document.querySelector("[data-lang-switcher]");
    if (!host) return;
    if (SITE.i18n.enabled.length < 2) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = `
      <select class="select" aria-label="언어 선택" style="padding:8px 12px;border-radius:999px;font-size:.875rem;font-weight:600;width:auto">
        ${SITE.i18n.enabled.map((l) =>
          `<option value="${l}"${l === this.lang ? " selected" : ""}>${SITE.i18n.available[l] || l}</option>`
        ).join("")}
      </select>`;
    host.querySelector("select").addEventListener("change", (e) => this.set(e.target.value));
  },
};

window.I18N = I18N;
