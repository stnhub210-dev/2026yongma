-- ---------------------------------------------------------------------------
-- 방문객 사진 — 저장소(Storage) + 목록 테이블
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 한 번만 실행하면 됩니다.
-- 로그인 없이 누구나 올리고 누구나 볼 수 있으며, 지우는 것은 직원·관리자만 가능합니다.
-- ---------------------------------------------------------------------------

-- 1. 사진 파일을 담을 저장소 ------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 8388608,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "방문객사진 누구나 보기" on storage.objects;
create policy "방문객사진 누구나 보기" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "방문객사진 누구나 올리기" on storage.objects;
create policy "방문객사진 누구나 올리기" on storage.objects
  for insert with check (bucket_id = 'gallery');

-- 올린 파일을 덮어쓰거나 지우는 것은 직원·관리자만
drop policy if exists "방문객사진 관리자만 삭제" on storage.objects;
create policy "방문객사진 관리자만 삭제" on storage.objects
  for delete using (bucket_id = 'gallery' and public.is_staff());


-- 2. 사진 목록 테이블 --------------------------------------------------------
create table if not exists public.gallery_uploads (
  id         bigserial primary key,
  path       text not null,              -- 저장소 안의 원본 경로
  thumb_path text not null,              -- 목록에 쓰는 작은 사진 경로
  caption    text not null default '',   -- 올린 사람이 적은 한 줄 설명
  uploader   text not null default '',   -- 올린 사람 이름(선택 입력)
  taken_on   date,                       -- 사진을 찍은 날 (EXIF 또는 파일 날짜)
  taken_at   text,                       -- 찍은 시각 "HH:MM"
  w          int,
  h          int,
  created_at timestamptz not null default now()
);

create index if not exists gallery_uploads_taken_idx
  on public.gallery_uploads (taken_on desc, taken_at desc);

alter table public.gallery_uploads enable row level security;

drop policy if exists "방문객사진 목록 누구나 보기" on public.gallery_uploads;
create policy "방문객사진 목록 누구나 보기" on public.gallery_uploads
  for select using (true);

-- 올린 사람 구분: visitor = 방문객(아래 방문객 사진), staff = 수행사(위 날짜별 갤러리)
alter table public.gallery_uploads
  add column if not exists kind text not null default 'visitor';
alter table public.gallery_uploads drop constraint if exists gallery_uploads_kind_chk;
alter table public.gallery_uploads
  add constraint gallery_uploads_kind_chk check (kind in ('visitor', 'staff'));

drop policy if exists "방문객사진 목록 누구나 등록" on public.gallery_uploads;
create policy "방문객사진 목록 누구나 등록" on public.gallery_uploads
  for insert with check (
    length(coalesce(caption, '')) <= 200 and
    length(coalesce(uploader, '')) <= 40 and
    -- 수행사 사진은 직원·관리자 계정으로 로그인했을 때만
    (kind = 'visitor' or (kind = 'staff' and public.is_staff()))
  );

drop policy if exists "방문객사진 목록 관리자만 삭제" on public.gallery_uploads;
create policy "방문객사진 목록 관리자만 삭제" on public.gallery_uploads
  for delete using (public.is_staff());


-- 3. 올린 사람이 직접 지울 수 있게 하는 열쇠 -------------------------------
-- 로그인이 없으므로 "누가 올렸는지" 를 알 수 없습니다. 그래서 사진마다 임의의
-- 열쇠를 하나 만들어 올린 사람 브라우저에만 남겨 두고, 그 열쇠가 맞을 때만
-- 지워지게 합니다. 열쇠는 아래 표에 따로 담아 두고 아무도 읽지 못하게 막습니다.
create table if not exists public.gallery_upload_keys (
  photo_id   bigint primary key references public.gallery_uploads(id) on delete cascade,
  delete_key text not null
);

alter table public.gallery_upload_keys enable row level security;

-- 읽기 정책을 만들지 않았으므로 아무도 열쇠를 들여다볼 수 없습니다(등록만 가능).
drop policy if exists "열쇠 등록만 허용" on public.gallery_upload_keys;
create policy "열쇠 등록만 허용" on public.gallery_upload_keys
  for insert with check (length(delete_key) between 10 and 100);

-- 열쇠가 맞을 때만 사진을 지우고, 지워진 파일 경로를 알려 줍니다.
create or replace function public.gallery_delete(p_id bigint, p_key text)
returns table (path text, thumb_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(p_key) < 10 then
    return;                                   -- 열쇠가 없거나 너무 짧으면 아무것도 안 함
  end if;
  if not exists (
    select 1 from public.gallery_upload_keys k
     where k.photo_id = p_id and k.delete_key = p_key
  ) then
    return;                                   -- 열쇠가 맞지 않으면 아무것도 안 함
  end if;
  return query
    delete from public.gallery_uploads g
     where g.id = p_id
    returning g.path, g.thumb_path;
end $$;

grant execute on function public.gallery_delete(bigint, text) to anon, authenticated;

-- 목록에서 빠진 사진 파일은 누구나 치울 수 있게 합니다.
-- 목록에 살아 있는 사진은 이 조건에 걸리지 않으므로 남의 사진은 지워지지 않습니다.
drop policy if exists "방문객사진 주인 없는 파일 정리" on storage.objects;
create policy "방문객사진 주인 없는 파일 정리" on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and not exists (
      select 1 from public.gallery_uploads g
       where g.path = name or g.thumb_path = name
    )
  );
