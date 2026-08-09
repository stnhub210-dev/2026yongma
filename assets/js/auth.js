/* ==========================================================================
   Supabase 인증 래퍼
   Supabase 미설정 상태에서도 사이트가 깨지지 않고 안내 메시지를 띄우도록 구성
   ========================================================================== */

const Auth = {
  _client: null,
  _profile: undefined, // undefined = 미조회, null = 없음

  client() {
    if (this._client) return this._client;
    if (!SITE.isSupabaseReady() || !window.supabase) return null;
    this._client = window.supabase.createClient(SITE.supabase.url, SITE.supabase.anonKey);
    return this._client;
  },

  ready() { return !!this.client(); },

  /* ---------- 세션 ---------- */
  async session() {
    const c = this.client();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session || null;
  },

  async user() {
    const s = await this.session();
    return s ? s.user : null;
  },

  async profile() {
    if (this._profile !== undefined) return this._profile;
    const c = this.client();
    const u = await this.user();
    if (!c || !u) return (this._profile = null);
    const { data } = await c.from("profiles").select("*").eq("id", u.id).maybeSingle();
    return (this._profile = data || null);
  },

  async isAdmin() {
    const p = await this.profile();
    return !!p && (p.role === "admin" || p.role === "staff");
  },

  /* ---------- 동작 ---------- */
  async signUp({ email, password, name, phone, marketing }) {
    const c = this.client();
    if (!c) throw new Error("NOT_CONFIGURED");
    const { data, error } = await c.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, marketing_opt_in: !!marketing },
        emailRedirectTo: `${location.origin}/login.html`,
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn({ email, password }) {
    const c = this.client();
    if (!c) throw new Error("NOT_CONFIGURED");
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._profile = undefined;
    return data;
  },

  async signOut() {
    const c = this.client();
    if (c) await c.auth.signOut();
    this._profile = undefined;
  },

  async resetPassword(email) {
    const c = this.client();
    if (!c) throw new Error("NOT_CONFIGURED");
    const { error } = await c.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/login.html`,
    });
    if (error) throw error;
  },

  /* ---------- 가드 ---------- */
  async requireAuth(redirect = "login.html") {
    const u = await this.user();
    if (!u) { location.replace(redirect); return null; }
    return u;
  },

  async requireAdmin(redirect = "../login.html") {
    const u = await this.user();
    if (!u) { location.replace(redirect); return null; }
    if (!(await this.isAdmin())) {
      document.body.innerHTML =
        '<div style="max-width:520px;margin:14vh auto;padding:0 20px;text-align:center;font-family:Pretendard,sans-serif">' +
        '<h1 style="font-size:1.5rem;margin-bottom:12px">접근 권한이 없습니다</h1>' +
        '<p style="color:#57534E;margin-bottom:24px">관리자 권한이 있는 계정으로 로그인해 주십시오.</p>' +
        '<a href="../index.html" style="display:inline-block;padding:12px 24px;background:#F5883A;color:#fff;border-radius:999px;font-weight:700;text-decoration:none">홈으로</a></div>';
      return null;
    }
    return u;
  },

  /* ---------- 헤더 UI 동기화 ---------- */
  async paintHeader() {
    const box = document.querySelector("[data-auth-box]");
    if (!box) return;
    const base = document.documentElement.dataset.base || "";

    if (!this.ready()) {
      box.innerHTML = `<a class="btn btn--ghost btn--sm" href="${base}login.html">로그인</a>`;
      return;
    }
    const u = await this.user();
    if (!u) {
      box.innerHTML =
        `<a class="btn btn--ghost btn--sm" href="${base}login.html">로그인</a>` +
        `<a class="btn btn--primary btn--sm" href="${base}login.html#signup">회원가입</a>`;
      return;
    }
    const p = await this.profile();
    const admin = p && (p.role === "admin" || p.role === "staff");
    box.innerHTML =
      (admin ? `<a class="btn btn--ghost btn--sm" href="${base}admin/index.html">관리자</a>` : "") +
      `<a class="btn btn--ghost btn--sm" href="${base}mypage.html">마이페이지</a>` +
      `<button class="btn btn--dark btn--sm" data-signout>로그아웃</button>`;
    box.querySelector("[data-signout]")?.addEventListener("click", async () => {
      await this.signOut();
      location.href = base + "index.html";
    });
  },
};

window.Auth = Auth;
