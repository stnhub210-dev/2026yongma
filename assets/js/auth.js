/* ==========================================================================
   Supabase 인증 래퍼
   Supabase 미설정 상태에서도 사이트가 깨지지 않고 안내 메시지를 띄우도록 구성
   ========================================================================== */

const Auth = {
  _client: null,
  _profile: undefined, // undefined = 미조회, null = 없음
  _providers: null,    // 켜져 있는 소셜 로그인 목록(한 번만 조회해 둡니다)

  client() {
    if (this._client) return this._client;
    if (!SITE.isSupabaseReady() || !window.supabase) return null;
    this._client = window.supabase.createClient(SITE.supabase.url, SITE.supabase.anonKey);
    return this._client;
  },

  ready() { return !!this.client(); },

  /* 켜져 있는 소셜 로그인 목록 (예: ["google","kakao"])
     Supabase 는 꺼진 업체로 보내면 로그인 화면 대신 오류 글자만 띄웁니다.
     그래서 버튼을 보여 주기 전에 무엇이 켜져 있는지 먼저 물어봅니다.
     못 물어보면 빈 목록 — 버튼을 감춰 두는 편이 오류 화면보다 낫습니다. */
  async enabledProviders() {
    if (this._providers) return this._providers;
    if (!SITE.isSupabaseReady()) return (this._providers = []);
    try {
      const r = await fetch(`${SITE.supabase.url}/auth/v1/settings`, {
        headers: { apikey: SITE.supabase.anonKey },
      });
      if (!r.ok) throw new Error("settings");
      const ext = (await r.json()).external || {};
      return (this._providers = Object.keys(ext).filter((k) => ext[k]));
    } catch (e) {
      return (this._providers = []);
    }
  },

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

  /* 소셜 로그인(구글·카카오)
     누르면 해당 업체 로그인 화면으로 넘어갔다가 login.html 로 돌아옵니다.
     돌아온 뒤 처리는 login.html 의 '소셜 로그인으로 돌아왔을 때' 부분이 맡습니다.
     Supabase 대시보드(Authentication → Providers)에서 그 업체를 켜 두어야 동작하며,
     꺼져 있으면 PROVIDER_OFF 를 던져 화면에 안내를 띄웁니다. */
  async signInWithProvider(provider) {
    const c = this.client();
    if (!c) throw new Error("NOT_CONFIGURED");
    const { data, error } = await c.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}${location.pathname}`,
      },
    });
    if (error) {
      if (/provider is not enabled|Unsupported provider/i.test(error.message || "")) {
        throw new Error("PROVIDER_OFF");
      }
      throw error;
    }
    return data;
  },

  /* 소셜 로그인은 업체가 이름만 주고 연락처·수신동의는 주지 않습니다.
     비어 있는 칸만 채워 두었다가 마이페이지에서 보완하도록 합니다. */
  async fillProfileAfterOAuth(marketing) {
    const c = this.client();
    const u = await this.user();
    if (!c || !u) return;
    const meta = u.user_metadata || {};
    const name = meta.name || meta.full_name || meta.user_name || "";
    const patch = {};
    const { data: row } = await c.from("profiles").select("name, marketing_opt_in").eq("id", u.id).maybeSingle();
    if (row && !row.name && name) patch.name = name;
    if (marketing && row && !row.marketing_opt_in) patch.marketing_opt_in = true;
    if (Object.keys(patch).length) {
      await c.from("profiles").update(patch).eq("id", u.id);
      this._profile = undefined;
    }
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
      // 관리자 버튼은 로그인 전에도 보여 준다. 운영자가 바로 들어갈 수 있어야 하고,
      // 관리자 화면 자체가 로그인과 권한을 다시 확인하므로 노출돼도 위험하지 않다.
      box.innerHTML =
        `<a class="btn btn--ghost btn--sm" href="${base}admin/index.html">관리자</a>` +
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
