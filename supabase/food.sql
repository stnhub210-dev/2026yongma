-- ---------------------------------------------------------------------------
-- 우리 가게 음식 자랑하기 — 상인회 점포 대상, 매달 말일 2곳 추첨 → STN 홍보 영상 촬영 + 홈페이지 메인 노출
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 한 번만 실행하면 됩니다. 여러 번 실행해도 안전합니다.
--
--  · 응모: 로그인 없이. 가게명·메뉴·사진 + (비공개) 사장님 이름·연락처. 응모 즉시 갤러리에 공개, 상인회 회원이 아니거나 부적절하면 관리자가 숨김·반려.
--  · 회차: 응모한 달(한국 시간) — 2026-10, 2026-11. 각 회차 말일에 공개된 응모 가게 중 2곳 추첨.
--  · 기간: 2026-10-10 ~ 2026-11-30 23:59 (한국 시간)
-- ---------------------------------------------------------------------------

-- 1. 사진 저장소 ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food', 'food', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "음식자랑 파일 누구나 보기" on storage.objects;
create policy "음식자랑 파일 누구나 보기" on storage.objects for select using (bucket_id = 'food');
drop policy if exists "음식자랑 파일 누구나 올리기" on storage.objects;
create policy "음식자랑 파일 누구나 올리기" on storage.objects for insert with check (bucket_id = 'food' and name like 'entries/%');
drop policy if exists "음식자랑 파일 관리자 삭제" on storage.objects;
create policy "음식자랑 파일 관리자 삭제" on storage.objects for delete using (bucket_id = 'food' and public.is_staff());


-- 2. 응모(공개되는 내용) -----------------------------------------------------------
create table if not exists public.food_entries (
  id          bigserial primary key,
  round       text not null,                       -- 회차 '2026-10' / '2026-11'
  shop_name   text not null,                       -- 가게 이름
  menu_name   text not null,                       -- 대표 메뉴
  intro       text not null default '',            -- 한 줄 자랑
  photo_path  text not null,
  photo_thumb text not null,
  w int, h int,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  winner      boolean not null default false,      -- 추첨 당첨
  winner_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists food_entries_round_idx on public.food_entries (round, status, created_at desc);
alter table public.food_entries enable row level security;

drop policy if exists "음식자랑 공개된 것만 보기" on public.food_entries;
create policy "음식자랑 공개된 것만 보기" on public.food_entries for select using (status = 'approved' or public.is_staff());
drop policy if exists "음식자랑 관리자 수정" on public.food_entries;
create policy "음식자랑 관리자 수정" on public.food_entries for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "음식자랑 관리자 삭제" on public.food_entries;
create policy "음식자랑 관리자 삭제" on public.food_entries for delete using (public.is_staff());
-- 직접 넣기(insert) 정책은 없다 — 아래 food_submit 함수로만 응모한다.


-- 3. 비공개 — 사장님 이름·연락처 (관리자만 본다) --------------------------------------
create table if not exists public.food_entry_private (
  entry_id   bigint primary key references public.food_entries(id) on delete cascade,
  owner_name text not null,
  phone      text not null,
  submitter  text not null default '',             -- 접속 주소 해시(도배 방지)
  created_at timestamptz not null default now()
);
alter table public.food_entry_private enable row level security;
drop policy if exists "음식자랑 연락처 관리자만" on public.food_entry_private;
create policy "음식자랑 연락처 관리자만" on public.food_entry_private for all using (public.is_staff()) with check (public.is_staff());


-- 4. 응모 함수 — 검사 → 등록(즉시 공개) → 연락처 비공개 저장 → 번호 ------------------------
create or replace function public.food_submit(
  p_shop text, p_menu text, p_intro text, p_owner text, p_phone text,
  p_photo text, p_thumb text, p_w int, p_h int)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
  kst    timestamp := now() at time zone 'Asia/Seoul';
  who    text := 'ip:' || md5(coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown'));
begin
  if kst < timestamp '2026-10-10 00:00' or kst >= timestamp '2026-12-01 00:00' then raise exception 'CLOSED'; end if;
  if length(btrim(coalesce(p_shop, ''))) not between 1 and 40 then raise exception 'BAD_SHOP'; end if;
  if length(btrim(coalesce(p_menu, ''))) not between 1 and 40 then raise exception 'BAD_MENU'; end if;
  if length(coalesce(p_intro, '')) > 200 then raise exception 'BAD_INTRO'; end if;
  if length(btrim(coalesce(p_owner, ''))) not between 1 and 20 then raise exception 'BAD_OWNER'; end if;
  if coalesce(p_phone, '') !~ '^[0-9\-\s]{9,15}$' then raise exception 'BAD_PHONE'; end if;
  if p_photo not like 'entries/%' or p_thumb not like 'entries/%' then raise exception 'BAD_PATH'; end if;
  -- 도배 방지: 같은 접속 주소에서 하루 10건까지
  if (select count(*) from food_entry_private where submitter = who
       and (created_at at time zone 'Asia/Seoul')::date = kst::date) >= 10 then raise exception 'DAILY_LIMIT'; end if;

  insert into food_entries (round, shop_name, menu_name, intro, photo_path, photo_thumb, w, h, status)
  values (to_char(kst, 'YYYY-MM'), btrim(p_shop), btrim(p_menu), coalesce(p_intro, ''), p_photo, p_thumb, p_w, p_h, 'approved')
  returning id into new_id;
  insert into food_entry_private (entry_id, owner_name, phone, submitter) values (new_id, btrim(p_owner), btrim(p_phone), who);
  return new_id;
end $$;
grant execute on function public.food_submit(text, text, text, text, text, text, text, int, int) to anon, authenticated;
