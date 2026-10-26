# pseo 폴더 작업 안내 (협력자용)

이 폴더는 **pSEO(프로그래매틱 SEO) 페이지 작업 전용 공간**입니다.
협력자는 이 `pseo/` 폴더 안에서만 파일을 올리고 내려받아 작업해 주세요.

---

## 1. 작업 원칙

| 구분 | 내용 |
|---|---|
| 작업 위치 | `pseo/` 폴더 안에서만 생성·수정·삭제 |
| 수정 금지 | `pseo/` 밖의 파일과 폴더 (index.html, admin, assets, supabase, CNAME 등) |
| 반영 시점 | main 브랜치에 올리는 즉시 실제 사이트(2026yongma.com)에 공개됩니다 |
| 공개 주소 | `pseo/파일명.html` → `https://2026yongma.com/pseo/파일명.html` |

> 폴더 밖의 파일을 고쳐야 할 경우, 직접 수정하지 말고 관리자에게 먼저 요청해 주세요.

---

## 2. 방법 A: 웹 브라우저에서 올리기 (간단한 작업)

**파일 올리기**
1. 저장소에서 `pseo` 폴더를 클릭해 들어갑니다.
2. 오른쪽 위 **Add file → Upload files**를 누릅니다.
3. 파일을 끌어다 놓습니다.
4. 아래 메시지 칸에 작업 내용을 적고 **Commit changes**를 누릅니다.

**파일 수정하기**
1. `pseo` 폴더 안의 파일을 엽니다.
2. 연필 아이콘(Edit)을 눌러 수정합니다.
3. **Commit changes**를 눌러 저장합니다.

**파일 내려받기**
- 파일을 열고 오른쪽 위 **다운로드(Download raw file)** 아이콘을 누릅니다.

---

## 3. 방법 B: GitHub Desktop 사용 (여러 파일 작업, 권장)

**처음 한 번만**
1. GitHub Desktop을 설치하고 협력자 계정으로 로그인합니다.
2. **File → Clone repository**에서 `stnhub210-dev/2026yongma`를 선택해 PC로 내려받습니다.

**매번 작업할 때**
1. 작업 전에 **Fetch origin → Pull origin**을 눌러 최신본을 받습니다. (가장 중요)
2. 내려받은 폴더 안의 `pseo` 폴더에서 파일을 만들거나 수정합니다.
3. GitHub Desktop 왼쪽 목록에 `pseo/` 파일만 표시되는지 확인합니다.
4. 아래 Summary 칸에 작업 내용을 적고 **Commit to main**을 누릅니다.
5. **Push origin**을 눌러 업로드합니다.

---

## 4. 방법 C: Git 명령어 (개발자용)

```bash
# 처음 한 번만
git clone https://github.com/stnhub210-dev/2026yongma.git
cd 2026yongma

# 매번 작업할 때
git pull                      # 최신본 받기
# pseo/ 폴더 안에서 작업
git add pseo/                 # pseo 폴더만 추가
git commit -m "pseo: 작업 내용"
git push
```

---

## 5. 파일 작성 규칙

- 파일명은 **영문 소문자, 숫자, 하이픈(-)** 만 사용합니다. 예: `yongma-food-street-korean-bbq.html`
- 한글 파일명과 띄어쓰기는 사용하지 않습니다.
- 이미지는 `pseo/images/` 폴더에 넣습니다.
- 커밋 메시지는 `pseo: 무엇을 했는지` 형식으로 적습니다. 예: `pseo: 맛집 키워드 페이지 10개 추가`

---

## 6. 주의 사항

- 작업 전에는 반드시 최신본을 먼저 받습니다. 받지 않고 올리면 충돌이 생길 수 있습니다.
- 올린 내용은 바로 공개되므로 개인정보, 비밀번호, API 키 등은 절대 올리지 않습니다.
- 실수로 잘못 올렸다면 직접 되돌리려 하지 말고 관리자에게 바로 알려 주세요.
- 이 안내 문서(`pseo/README.md`)는 지우지 마세요.

---

문의: 저장소 관리자(stnhub210-dev)
