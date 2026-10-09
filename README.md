# 용마미식거리 · 2026yongma.com

강원 강릉시 포남동 용마거리 — 2026 지역상권 육성사업(유망골목상권) 공식 홈페이지.

**공개용 사이트**와 **관리자 사이트**로 구성되며, GitHub Pages(정적 호스팅) + Supabase(회원·데이터·파일)로 동작합니다.
서버를 따로 운영할 필요가 없습니다.

---

## 구성

```
2026yongma.com/
├── index.html          홈
├── about.html          상권 소개
├── zones.html          6개 존
├── programs.html       프로그램·일정
├── food.html           미식 지도
├── news.html           소식
├── join.html           참여 신청
├── login.html          로그인 · 회원가입
├── mypage.html         마이페이지 (내 신청 내역)
│
├── admin/              관리자 (스태프 이상만 접근)
│   ├── index.html          대시보드 — 집행률·신청·성과지표
│   ├── applications.html   참여 신청 관리
│   ├── members.html        회원 관리 · 권한
│   ├── posts.html          공지·소식
│   ├── events.html         일정 관리
│   ├── shops.html          점포 관리
│   ├── budget.html         정산 관리  ★
│   └── docs.html           지침·서식 자료실  ★
│
├── assets/
│   ├── css/style.css       디자인 시스템 전체
│   ├── js/
│   │   ├── config.js       ★ Supabase 주소·키를 넣는 곳
│   │   ├── layout.js       헤더·푸터 (여기만 고치면 전 페이지 반영)
│   │   ├── i18n.js         다국어 엔진
│   │   ├── auth.js         로그인·권한
│   │   ├── main.js         공통 UI
│   │   └── admin.js        관리자 공통·CRUD
│   ├── i18n/               ko.json / en·zh·ja.json(빈 파일)
│   └── img/                웹 최적화 이미지 38개 (WebP, 총 4.5MB)
│
├── supabase/schema.sql ★ Supabase에 한 번 실행할 SQL (예산 시드 포함)
└── CNAME               2026yongma.com
```

---

## 처음 설정 (3단계)

### 1. Supabase 프로젝트 만들기

1. <https://supabase.com> 가입 → **New project** (Region: **Northeast Asia (Seoul)** 권장)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**
3. 좌측 **Storage** → **New bucket** → 이름 `docs`, **Public 체크 해제**(비공개)

### 2. 키 연결

Supabase **Settings → API** 에서 두 값을 복사해 `assets/js/config.js` 에 넣습니다.

```js
supabase: {
  url: "https://xxxxxxxx.supabase.co",   // Project URL
  anonKey: "eyJhbGciOi...",              // anon public key
}
```

> `anon key`는 공개되어도 되는 값입니다. 실제 보호는 SQL에 포함된 **RLS 정책**이 담당합니다.

### 3. 관리자 계정 지정

1. 사이트에서 **회원가입** → 메일 인증 완료
2. Supabase **SQL Editor** 에서 실행

```sql
update public.profiles set role = 'admin' where email = 'stnhub210@gmail.com';
```

이제 헤더에 **관리자** 버튼이 나타납니다.

---

## 배포

`docs/DEPLOY.md` 참고. 요약하면:

1. GitHub에 저장소 생성 → 이 폴더 push
2. Settings → Pages → Source: `main` / `/ (root)`
3. Custom domain에 `2026yongma.com` 입력 → 도메인 DNS에 A레코드 4개 + CNAME 설정
4. **Enforce HTTPS** 체크

---

## 다국어 (완성 후 진행)

지금은 한국어만 켜져 있습니다. 모든 문구는 `data-i18n` 키로 표시되어 있어,
**번역 파일만 채우고 한 줄 고치면** 언어 선택기가 자동으로 나타납니다.

1. `assets/i18n/en.json` `zh.json` `ja.json` 을 `ko.json` 구조에 맞춰 번역
2. `assets/js/config.js` 수정

```js
i18n: { default: "ko", enabled: ["ko", "en", "zh", "ja"], ... }
```

번역 파일이 없거나 키가 비어 있으면 **한국어 원문이 그대로 표시**되므로, 부분 번역 상태로도 사이트가 깨지지 않습니다.

---

## 콘텐츠는 어디서 고치나요

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 공지·소식 | 관리자 → 공지·소식 |
| 공연·행사 일정 | 관리자 → 일정 관리 |
| 미식 지도 점포 | 관리자 → 점포 관리 |
| 예산 집행액 | 관리자 → 정산 관리 |
| 지침·서식 파일 | 관리자 → 지침·서식 자료실 |
| 메뉴 이름·순서 | `assets/js/layout.js` 의 `NAV` |
| 사업 기본정보 | `assets/js/config.js` 의 `SITE` |
| 페이지 본문(고정 문구) | 해당 `.html` 파일 |
| 색상·글꼴 | `assets/css/style.css` 상단 `:root` |

---

## 기준 자료

본문 수치와 사업 내용은 **최종 운영계획서(v2)** 기준입니다.

- 총사업비 **276,000천원** (직접 234,600 / 간접 41,400 = 85:15)
- 골목어게인 **30회** (버스킹 15 + DJ 음악다방 15)
- K-컬처 기획공연 1회(10월) · 프리마켓 6회
- 정규행사 **2026. 10. 9.(금) ~ 11. 14.(토) 매주 금·토 17:00~22:00** (9월은 토요일만)
- 사업 수행 ~2026. 12. 31. · 사업 종료(결과보고) 2027. 3. 31.
- 상권 면적 29,171.14㎡ · 전체 168곳 / 회원 124곳

이미지는 제안발표자료 및 사업 시안(`Yongma/image`)에서 선별해 WebP로 최적화했습니다.

---

© 2026 용마미식거리 · 포남용마거리 골목형상점가 상인회
상권기획자 (주)에스티엔미디어 (114-87-25596)
