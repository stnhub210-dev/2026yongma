-- ---------------------------------------------------------------------------
-- 용마미식거리 사진전 — 응모작 게시판 + 시민투표
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 한 번만 실행하면 됩니다.
-- 여러 번 실행해도 안전합니다(있으면 건너뛰거나 정책만 다시 만듭니다).
--
--  · 부문: 사진(photo) / 숏폼 영상(short). 영상은 파일 대신 SNS 링크 + 대표 화면 캡처로 받는다.
--  · 응모: 로그인 없이 누구나. 관리자가 '승인' 해야 게시판에 보입니다.
--  · 투표: 로그인한 사람만, 부문별 하루(한국 시간) 3표, 같은 작품엔 하루 1표.
--  · 기간: 응모·투표 모두 2026-10-09 ~ 2026-12-30 (한국 시간). 발표 12-31 14:00.
--  · 시상 점수 = 심사 30% + 시민투표 70% (계산은 관리자 화면 admin/contest.html)
-- ---------------------------------------------------------------------------

-- 1. 사진 저장소 (방문객 갤러리와 따로 둔다 — 갤러리의 '주인 없는 파일 정리' 규칙에 걸리지 않게)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contest', 'contest', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "사진전 파일 누구나 보기" on storage.objects;
create policy "사진전 파일 누구나 보기" on storage.objects
  for select using (bucket_id = 'contest');

-- 올리기는 entries/ 폴더 안에만. 덮어쓰기(update) 정책은 만들지 않아 남의 파일을 바꿀 수 없다.
drop policy if exists "사진전 파일 누구나 올리기" on storage.objects;
create policy "사진전 파일 누구나 올리기" on storage.objects
  for insert with check (bucket_id = 'contest' and name like 'entries/%');

drop policy if exists "사진전 파일 관리자 삭제" on storage.objects;
create policy "사진전 파일 관리자 삭제" on storage.objects
  for delete using (bucket_id = 'contest' and public.is_staff());


-- 2. 응모작 -----------------------------------------------------------------
create table if not exists public.contest_entries (
  id          bigserial primary key,
  category    text not null default 'photo'  -- 부문: photo 사진 / short 숏폼 영상
              check (category in ('photo', 'short')),
  title       text not null,                 -- 작품 제목
  nickname    text not null,                 -- 게시판에 보일 이름
  sns_url     text not null,                 -- 본인 SNS 게시물 주소
  story       text not null default '',      -- 사진에 붙이는 한마디(선택)
  photo_path  text not null,                 -- 응모 사진(크게)
  photo_thumb text not null,                 -- 응모 사진(목록용)
  proof_path  text not null,                 -- SNS 게시 인증샷(캡처)
  w           int,
  h           int,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  vote_count  int  not null default 0,       -- 시민투표 수 (contest_vote 함수만 올린다)
  created_at  timestamptz not null default now()
);
-- 부문 칸이 생기기 전에 표를 만든 경우를 위해(이미 있으면 건너뜀)
alter table public.contest_entries add column if not exists category text not null default 'photo';
create index if not exists contest_entries_status_idx on public.contest_entries (status, category, created_at desc);

alter table public.contest_entries enable row level security;

drop policy if exists "응모작 승인된 것만 보기" on public.contest_entries;
create policy "응모작 승인된 것만 보기" on public.contest_entries
  for select using (status = 'approved' or public.is_staff());

-- 누구나 응모. 단 상태·투표수는 처음 값으로만, 마감(12-30 24:00 한국 시간) 전까지만.
drop policy if exists "응모작 누구나 등록" on public.contest_entries;
create policy "응모작 누구나 등록" on public.contest_entries
  for insert with check (
    status = 'pending' and vote_count = 0
    and category in ('photo', 'short')
    and length(btrim(title)) between 1 and 40
    and length(btrim(nickname)) between 1 and 20
    and length(sns_url) <= 300 and sns_url ~* '^https?://'
    and length(story) <= 300
    and photo_path like 'entries/%' and photo_thumb like 'entries/%' and proof_path like 'entries/%'
    and (now() at time zone 'Asia/Seoul') < timestamp '2026-12-31 00:00'
  );

drop policy if exists "응모작 관리자 수정" on public.contest_entries;
create policy "응모작 관리자 수정" on public.contest_entries
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "응모작 관리자 삭제" on public.contest_entries;
create policy "응모작 관리자 삭제" on public.contest_entries
  for delete using (public.is_staff());

-- 목록에서 지워진 응모작의 파일은 누구나 치울 수 있게(본인 삭제 후 파일 정리용).
drop policy if exists "사진전 주인 없는 파일 정리" on storage.objects;
create policy "사진전 주인 없는 파일 정리" on storage.objects
  for delete using (
    bucket_id = 'contest'
    and not exists (
      select 1 from public.contest_entries e
       where e.photo_path = name or e.photo_thumb = name or e.proof_path = name
    )
  );


-- 3. 응모한 사람이 직접 지울 수 있게 하는 열쇠 (갤러리와 같은 방식) ----------
create table if not exists public.contest_entry_keys (
  entry_id   bigint primary key references public.contest_entries(id) on delete cascade,
  delete_key text not null
);
alter table public.contest_entry_keys enable row level security;

drop policy if exists "사진전 열쇠 등록만" on public.contest_entry_keys;
create policy "사진전 열쇠 등록만" on public.contest_entry_keys
  for insert with check (length(delete_key) between 10 and 100);

create or replace function public.contest_delete(p_id bigint, p_key text)
returns table (photo_path text, photo_thumb text, proof_path text)
language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or length(p_key) < 10 then return; end if;
  if not exists (select 1 from public.contest_entry_keys k where k.entry_id = p_id and k.delete_key = p_key) then
    return;
  end if;
  return query
    delete from public.contest_entries e where e.id = p_id
    returning e.photo_path, e.photo_thumb, e.proof_path;
end $$;
grant execute on function public.contest_delete(bigint, text) to anon, authenticated;


-- 4. 심사 점수 (관리자만 보고 쓴다 — 발표 전 공개되지 않게 응모작 표와 분리) ---
create table if not exists public.contest_scores (
  entry_id    bigint primary key references public.contest_entries(id) on delete cascade,
  judge_score numeric(5, 2) check (judge_score between 0 and 100),
  memo        text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.contest_scores enable row level security;

drop policy if exists "심사점수 관리자만" on public.contest_scores;
create policy "심사점수 관리자만" on public.contest_scores
  for all using (public.is_staff()) with check (public.is_staff());


-- 5. 시민투표 ---------------------------------------------------------------
create table if not exists public.contest_votes (
  id         bigserial primary key,
  entry_id   bigint not null references public.contest_entries(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  vote_day   date   not null,                        -- 한국 시간 기준 날짜
  created_at timestamptz not null default now(),
  unique (entry_id, user_id, vote_day)
);
create index if not exists contest_votes_user_day_idx on public.contest_votes (user_id, vote_day);

alter table public.contest_votes enable row level security;

-- 내 투표 기록만 보기(오늘 남은 표 계산용). 직접 넣기 정책은 없다 — contest_vote 함수로만.
drop policy if exists "내 투표만 보기" on public.contest_votes;
create policy "내 투표만 보기" on public.contest_votes
  for select using (user_id = auth.uid() or public.is_staff());

-- 투표하기: 결과를 글자로 돌려준다
--   OK / LOGIN(로그인 필요) / CLOSED(기간 아님) / NOENTRY(없는·미승인 작품) / DUP(오늘 이미 투표) / LIMIT(이 부문 오늘 3표 다 씀)
--   votes_left 는 그 작품이 속한 부문의 오늘 남은 표
create or replace function public.contest_vote(p_entry bigint)
returns table (result text, votes_left int, entry_votes int)
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'Asia/Seoul')::date;
  cat   text;
  used  int;
  cnt   int;
begin
  if uid is null then
    return query select 'LOGIN'::text, 0, 0; return;
  end if;
  if today < date '2026-10-09' or today > date '2026-12-30' then
    return query select 'CLOSED'::text, 0, 0; return;
  end if;
  select category into cat from contest_entries where id = p_entry and status = 'approved';
  if cat is null then
    return query select 'NOENTRY'::text, 0, 0; return;
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));          -- 같은 사람이 동시에 눌러도 3표를 넘지 않게

  -- 같은 부문에서 오늘 쓴 표
  select count(*) into used
    from contest_votes v join contest_entries e on e.id = v.entry_id
   where v.user_id = uid and v.vote_day = today and e.category = cat;
  if exists (select 1 from contest_votes where user_id = uid and vote_day = today and entry_id = p_entry) then
    select vote_count into cnt from contest_entries where id = p_entry;
    return query select 'DUP'::text, greatest(3 - used, 0), cnt; return;
  end if;
  if used >= 3 then
    select vote_count into cnt from contest_entries where id = p_entry;
    return query select 'LIMIT'::text, 0, cnt; return;
  end if;

  insert into contest_votes (entry_id, user_id, vote_day) values (p_entry, uid, today);
  update contest_entries set vote_count = vote_count + 1 where id = p_entry returning vote_count into cnt;
  return query select 'OK'::text, 3 - used - 1, cnt;
end $$;
grant execute on function public.contest_vote(bigint) to authenticated;


-- 5-1. 응모하기 함수 — 방문객은 승인 전 응모작을 읽을 수 없어서(RLS) 직접 넣으면 번호를 돌려받지 못한다.
--      그래서 이 함수가 검사 → 등록 → 지우기 열쇠 저장까지 한 번에 하고 번호만 돌려준다.
create or replace function public.contest_submit(
  p_category text, p_title text, p_nickname text, p_sns_url text, p_story text,
  p_photo text, p_thumb text, p_proof text, p_w int, p_h int, p_key text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if (now() at time zone 'Asia/Seoul') >= timestamp '2026-12-31 00:00' then raise exception 'CLOSED'; end if;
  if p_category not in ('photo', 'short') then raise exception 'BAD_CATEGORY'; end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 40 then raise exception 'BAD_TITLE'; end if;
  if length(btrim(coalesce(p_nickname, ''))) not between 1 and 20 then raise exception 'BAD_NICKNAME'; end if;
  if p_sns_url is null or length(p_sns_url) > 300 or p_sns_url !~* '^https?://' then raise exception 'BAD_URL'; end if;
  if length(coalesce(p_story, '')) > 300 then raise exception 'BAD_STORY'; end if;
  if p_photo not like 'entries/%' or p_thumb not like 'entries/%' or p_proof not like 'entries/%' then raise exception 'BAD_PATH'; end if;
  if p_key is null or length(p_key) not between 10 and 100 then raise exception 'BAD_KEY'; end if;

  insert into contest_entries (category, title, nickname, sns_url, story, photo_path, photo_thumb, proof_path, w, h)
  values (p_category, btrim(p_title), btrim(p_nickname), p_sns_url, coalesce(p_story, ''), p_photo, p_thumb, p_proof, p_w, p_h)
  returning id into new_id;
  insert into contest_entry_keys (entry_id, delete_key) values (new_id, p_key);
  return new_id;
end $$;
grant execute on function public.contest_submit(text, text, text, text, text, text, text, text, int, int, text) to anon, authenticated;


-- 6. Realtime 켜기 — 메인 페이지 '지금 올라온 응모작' 이 새로고침 없이 바뀌도록 ----------
-- 응모작 표의 변경(승인·투표수)을 브라우저로 바로 보낸다. 보이는 범위는 위 RLS(승인된 것만)를 따른다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contest_entries'
  ) then
    alter publication supabase_realtime add table public.contest_entries;
  end if;
end $$;
