# 배포 및 도메인 연결 안내

GitHub Pages로 무료 호스팅하고 `2026yongma.com` 을 연결하는 절차입니다.

---

## 1. GitHub에 올리기

### GitHub Desktop을 쓰는 경우 (권장)

1. GitHub Desktop 실행 → **File → Add local repository**
2. 이 폴더(`D:\claude\2026yongma`) 선택
3. "create a repository" 안내가 나오면 클릭
4. 좌하단 **Commit to main** → 우상단 **Publish repository**
   - Name: `2026yongma`
   - **Keep this code private 체크 해제** (GitHub Pages 무료 플랜은 공개 저장소만 가능)
5. **Publish**

### 명령줄을 쓰는 경우

```bash
cd D:\claude\2026yongma
git init
git add .
git commit -m "용마미식거리 홈페이지 초기 구축"
git branch -M main
git remote add origin https://github.com/<계정명>/2026yongma.git
git push -u origin main
```

---

## 2. GitHub Pages 켜기

1. 저장소 → **Settings** → 좌측 **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / 폴더 `/ (root)` → **Save**
4. 1~2분 뒤 `https://<계정명>.github.io/2026yongma/` 로 접속 확인

> 저장소 이름이 `2026yongma`이면 주소에 `/2026yongma/`가 붙습니다.
> 커스텀 도메인을 연결하면 이 경로 없이 `https://2026yongma.com` 으로 접속됩니다.

---

## 3. 도메인 연결

### 3-1. 도메인 등록처(가비아·후이즈 등) DNS 설정

**A 레코드 4개** (호스트 `@` 또는 비움)

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**CNAME 레코드 1개**

```
호스트: www      값: <계정명>.github.io
```

### 3-2. GitHub 설정

1. 저장소 → **Settings → Pages → Custom domain** 에 `2026yongma.com` 입력 → **Save**
   - 저장소에 이미 `CNAME` 파일이 있어 자동으로 잡히기도 합니다.
2. DNS 검증이 끝나면 **Enforce HTTPS** 체크

> DNS 전파에 보통 10분~1시간, 길면 24시간이 걸립니다.
> 인증서 발급 전까지 "not yet available" 경고가 보이는 것은 정상입니다.

---

## 4. Supabase 도메인 등록 (회원가입 메일 링크용)

Supabase → **Authentication → URL Configuration**

- **Site URL**: `https://2026yongma.com`
- **Redirect URLs** 에 추가
  - `https://2026yongma.com/login.html`
  - `https://2026yongma.com/**`

이 설정을 하지 않으면 가입 확인 메일의 링크가 `localhost`로 연결됩니다.

---

## 5. 수정 후 반영하기

파일을 고친 뒤 **Commit → Push** 하면 1~2분 안에 사이트에 반영됩니다.
관리자 페이지에서 입력하는 공지·일정·점포·정산 데이터는 Supabase에 저장되므로 **push가 필요 없습니다.**

---

## 로컬에서 미리 보기

`file://` 로 열면 `fetch`가 막혀 다국어 파일을 못 읽습니다. 간단한 서버로 여십시오.

```bash
cd D:\claude\2026yongma
python -m http.server 8080
```

→ 브라우저에서 `http://localhost:8080`

---

## 점검 목록

- [ ] `assets/js/config.js` 에 Supabase URL·anon key 입력
- [ ] `supabase/schema.sql` 실행 (예산 42개 항목 자동 입력됨)
- [ ] Storage `docs` 버킷 생성 (비공개)
- [ ] 회원가입 후 `profiles.role`을 `admin`으로 변경
- [ ] Supabase Site URL / Redirect URL 등록
- [ ] GitHub Pages Source 설정
- [ ] DNS A레코드 4개 + www CNAME
- [ ] Enforce HTTPS 체크
- [ ] 관리자 → 정산 관리에서 합계 **276,000천원** 확인
