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

drop policy if exists "방문객사진 목록 누구나 등록" on public.gallery_uploads;
create policy "방문객사진 목록 누구나 등록" on public.gallery_uploads
  for insert with check (
    length(coalesce(caption, '')) <= 200 and
    length(coalesce(uploader, '')) <= 40
  );

drop policy if exists "방문객사진 목록 관리자만 삭제" on public.gallery_uploads;
create policy "방문객사진 목록 관리자만 삭제" on public.gallery_uploads
  for delete using (public.is_staff());
