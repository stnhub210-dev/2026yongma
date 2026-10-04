/* ==========================================================================
   용마미식거리 — 사이트 공통 설정
   Supabase 프로젝트를 만든 뒤 아래 두 값만 교체하면 회원가입·관리자 기능이 켜집니다.
   (anon key 는 공개되어도 되는 값입니다. 실제 보호는 Supabase RLS 정책이 담당합니다.)
   ========================================================================== */

window.SITE = {
  name: "용마미식거리",
  nameEn: "Yongma Food Street",
  tagline: "강릉의 밤을 물들이는 예술·미식·문화 야간 골목상권",
  domain: "2026yongma.com",
  year: 2026,

  org: {
    planner: "(주)에스티엔미디어",
    plannerBiz: "114-87-25596",
    merchants: "포남용마거리 골목형상점가 상인회",
    partner: "강원영동이벤트",
    gov: "강릉시 · 강원특별자치도",
    address: "강원특별자치도 강릉시 포남동 용마거리 일원",
    localOffice: "강원특별자치도 강릉시 경강로 2258 3층",
  },

  // 주요 운영: 2026.10.16부터 매주 금·토요일 17:00~22:00 (2026.10.4 운영일 변경 — 토 → 금·토)
  // 현장 운영은 2026.12.31까지, 사업기간은 2027.3.31까지(2027년 1~3월은 정산·결과보고)
  openHours: { days: "매주 금·토요일", time: "17:00 ~ 22:00", season: "2026년 10월 ~ 12월" },
  opening: "2026. 10. 16.(금)",
  period: "협약일 ~ 2027. 3. 31.",

  supabase: {
    url: "https://xellnstqcvsdhrgveouh.supabase.co",
    anonKey: "sb_publishable_ONMbttWvtDcBoJWLE0Za0g_Q2XMDg6g",
  },

  i18n: {
    default: "ko",
    // 사이트 완성 후 en/zh/ja 를 여기에 추가하면 언어 선택기가 자동으로 나타납니다.
    enabled: ["ko"],
    available: { ko: "한국어", en: "English", zh: "中文", ja: "日本語" },
  },
};

window.SITE.isSupabaseReady = function () {
  const s = window.SITE.supabase;
  return !!(s.url && s.anonKey && !s.url.includes("YOUR-PROJECT-REF") && !s.anonKey.includes("YOUR-PUBLIC"));
};
