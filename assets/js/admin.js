/* ==========================================================================
   관리자 공통 — 사이드바 / 권한 가드 / CRUD 유틸
   ========================================================================== */

const ADMIN_NAV = [
  ["운영", [
    ["index.html",        "대시보드",      "▤"],
    ["applications.html", "참여 신청 관리", "📥"],
    ["members.html",      "회원 관리",     "👥"],
  ]],
  ["콘텐츠", [
    ["posts.html",  "공지·소식", "📰"],
    ["events.html", "일정 관리", "📅"],
    ["shops.html",  "점포 관리", "🏪"],
    ["contest.html", "사진전 심사", "📷"],
    ["food.html",    "음식 자랑 추첨", "🍲"],
  ]],
  ["사업 관리", [
    ["budget.html", "정산 관리",   "💰"],
    ["docs.html",   "지침·서식 자료실", "📚"],
  ]],
];

const Admin = {
  c: null,
  user: null,
  profile: null,

  async boot(active) {
    this.renderSide(active);

    if (!Auth.ready()) {
      document.getElementById("admin-main").innerHTML = `
        <div class="alert alert--warn show" style="display:block">
          <b>Supabase가 연결되지 않았습니다.</b><br>
          <code>assets/js/config.js</code> 의 <code>supabase.url</code> 과 <code>supabase.anonKey</code> 를 입력하고
          <code>supabase/schema.sql</code> 을 실행하면 관리자 기능이 활성화됩니다.
        </div>`;
      return false;
    }
    this.user = await Auth.requireAdmin("../login.html");
    if (!this.user) return false;
    this.profile = await Auth.profile();
    this.c = Auth.client();

    const who = document.getElementById("admin-who");
    if (who) who.textContent = `${this.profile?.name || this.user.email} · ${this.profile?.role === "admin" ? "관리자" : "스태프"}`;
    return true;
  },

  renderSide(active) {
    const el = document.getElementById("admin-side");
    if (!el) return;
    el.outerHTML = `
<aside class="admin-side">
  <a class="brand" href="../index.html">
    <img src="../assets/img/mascot-yong.webp" alt="">
    <span>용마미식거리<small>ADMIN</small></span>
  </a>
  ${ADMIN_NAV.map(([group, items]) => `
    <div class="admin-nav-group">
      <p>${group}</p>
      ${items.map(([href, label, icon]) =>
        `<a href="${href}"${href === active ? ' aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</a>`
      ).join("")}
    </div>`).join("")}
  <div class="admin-nav-group" style="margin-top:auto">
    <p>계정</p>
    <a href="../index.html"><span aria-hidden="true">↩</span>홈페이지로</a>
    <a href="#" id="admin-signout"><span aria-hidden="true">⏻</span>로그아웃</a>
  </div>
</aside>`;
    document.getElementById("admin-signout")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await Auth.signOut();
      location.href = "../index.html";
    });
  },

  /* ---------- 유틸 ---------- */
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  },

  async load(table, opts = {}) {
    let q = this.c.from(table).select(opts.select || "*");
    if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => (q = q.eq(k, v)));
    if (opts.order) q = q.order(opts.order[0], { ascending: opts.order[1] !== false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async save(table, row) {
    const { data, error } = row.id
      ? await this.c.from(table).update(row).eq("id", row.id).select()
      : await this.c.from(table).insert(row).select();
    if (error) throw error;
    return data;
  },

  async remove(table, id) {
    const { error } = await this.c.from(table).delete().eq("id", id);
    if (error) throw error;
  },

  toast(type, text) {
    const box = document.getElementById("admin-msg");
    if (!box) return alert(text);
    UI.alert(box, type, text);
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (type === "ok") setTimeout(() => UI.clearAlert(box), 3500);
  },

  /* 간단 모달 폼 */
  modal({ title, fields, values = {}, onSave }) {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:200;background:rgba(18,16,14,.5);display:grid;place-items:center;padding:20px;overflow:auto";
    wrap.innerHTML = `
      <div style="background:#fff;border-radius:20px;max-width:640px;width:100%;padding:28px;max-height:90vh;overflow:auto">
        <h3 style="margin-bottom:20px">${this.esc(title)}</h3>
        <form id="m-form">
          ${fields.map((f) => {
            const v = values[f.k] ?? f.def ?? "";
            const req = f.req ? " required" : "";
            if (f.type === "textarea")
              return `<div class="field"><label>${f.label}</label><textarea class="textarea" name="${f.k}"${req}>${this.esc(v)}</textarea></div>`;
            if (f.type === "select")
              return `<div class="field"><label>${f.label}</label><select class="select" name="${f.k}">${
                f.options.map(([val, lab]) => `<option value="${val}"${String(v) === String(val) ? " selected" : ""}>${lab}</option>`).join("")
              }</select></div>`;
            if (f.type === "checkbox")
              return `<div class="field"><label class="checkbox"><input type="checkbox" name="${f.k}"${v ? " checked" : ""}><span>${f.label}</span></label></div>`;
            return `<div class="field"><label>${f.label}</label><input class="input" type="${f.type || "text"}" name="${f.k}" value="${this.esc(v)}"${req}></div>`;
          }).join("")}
          <div class="btn-row" style="justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn--ghost" id="m-cancel">취소</button>
            <button type="submit" class="btn btn--primary">저장</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector("#m-cancel").onclick = close;
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    wrap.querySelector("#m-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const out = { ...values };
      fields.forEach((f) => {
        out[f.k] = f.type === "checkbox" ? fd.get(f.k) === "on"
                 : f.type === "number" ? (fd.get(f.k) === "" ? null : Number(fd.get(f.k)))
                 : (fd.get(f.k) ?? "").toString().trim() || null;
      });
      try { await onSave(out); close(); }
      catch (err) { alert("저장 실패: " + err.message); }
    };
  },
};

window.Admin = Admin;
