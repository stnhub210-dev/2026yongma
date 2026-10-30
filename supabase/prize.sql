-- ---------------------------------------------------------------------------
-- 경품 지급 · 수령 서명 — 현장에서 경품을 건넨 뒤 받는 분에게 바로 서명을 받아 남긴다 (admin/prize.html)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 한 번만 실행하면 됩니다. 여러 번 실행해도 안전합니다.
--
--  · 누가 쓰나: 스태프·관리자만. 받는 분은 담당자의 휴대폰·태블릿 화면에 손가락으로 서명한다(로그인 필요 없음).
--  · 서명: PNG 이미지(data:image/png;base64,…)를 표에 그대로 저장한다 — 별도 저장소 버킷이 필요 없다.
--  · 수정 불가: 서명이 붙은 기록은 고칠 수 없다(정산 증빙). 잘못 받았으면 관리자가 삭제하고 다시 받는다.
-- ---------------------------------------------------------------------------

create table if not exists public.prize_receipts (
  id             bigserial primary key,
  event_name     text not null,                         -- 행사·이벤트 이름 (예: 사진전 시상, 음식 자랑 추첨, 현장 스탬프 투어)
  prize_name     text not null,                         -- 경품 이름 (예: 온누리상품권 3만원권)
  qty            int  not null default 1 check (qty between 1 and 999),
  unit_price     int  check (unit_price is null or unit_price >= 0),   -- 단가(원) — 정산용, 모르면 비움
  recipient_name text not null,                         -- 받는 분 성명
  phone          text not null default '',              -- 받는 분 연락처
  privacy_agreed boolean not null default false,        -- 개인정보 수집·이용 동의
  signature      text not null,                         -- 서명 PNG (data URL)
  memo           text not null default '',
  given_by       uuid references auth.users(id) on delete set null,   -- 지급 담당자
  given_by_name  text not null default '',
  signed_at      timestamptz not null default now(),
  constraint prize_sig_png check (signature like 'data:image/png;base64,%' and length(signature) < 400000),
  constraint prize_privacy check (privacy_agreed)
);
create index if not exists prize_receipts_signed_idx on public.prize_receipts (signed_at desc);
alter table public.prize_receipts enable row level security;

drop policy if exists "경품수령 스태프 보기" on public.prize_receipts;
create policy "경품수령 스태프 보기" on public.prize_receipts for select using (public.is_staff());
drop policy if exists "경품수령 스태프 등록" on public.prize_receipts;
create policy "경품수령 스태프 등록" on public.prize_receipts for insert with check (public.is_staff());
drop policy if exists "경품수령 관리자 삭제" on public.prize_receipts;
create policy "경품수령 관리자 삭제" on public.prize_receipts for delete using (public.is_admin());
-- 수정(update) 정책은 없다 — 서명된 기록은 고칠 수 없다.
