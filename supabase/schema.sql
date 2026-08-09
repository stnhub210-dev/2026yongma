-- ============================================================================
--  용마미식거리 (2026yongma.com) — Supabase 스키마
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 한 번 실행하십시오.
--  실행 후 Storage 에 'docs' 버킷(비공개)을 만들면 자료실이 동작합니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 프로필 (auth.users 확장)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  name             text,
  phone            text,
  role             text not null default 'member'   -- member | staff | admin
                   check (role in ('member','staff','admin')),
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now()
);

-- 회원가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, phone, marketing_opt_in)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 권한 판별 헬퍼 (RLS 재귀 방지를 위해 security definer)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff','admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. 공지·소식
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id           bigserial primary key,
  category     text not null default 'notice'  -- notice | event | recruit | press
               check (category in ('notice','event','recruit','press')),
  title        text not null,
  summary      text,
  body         text not null,
  cover_url    text,
  published    boolean not null default true,
  pinned       boolean not null default false,
  published_at date default current_date,
  author_id    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. 일정
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          bigserial primary key,
  event_date  date not null,
  start_time  time,
  category    text not null default 'busking'  -- busking | culture | market | experience | etc
              check (category in ('busking','culture','market','experience','etc')),
  title       text not null,
  place       text,
  description text,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. 점포 (미식 지도)
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id          bigserial primary key,
  name        text not null,
  category    text not null default 'korean'   -- korean | cafe | snack | etc
              check (category in ('korean','cafe','snack','etc')),
  signature   text,
  description text,
  address     text,
  phone       text,
  photo_url   text,
  is_belt     boolean not null default false,  -- K-미식벨트 어서와존 참여 여부
  sort_order  int not null default 999,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. 참여 신청
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id             bigserial primary key,
  user_id        uuid references public.profiles(id) on delete set null,
  type           text not null   -- seller | busker | experience | startup
                 check (type in ('seller','busker','experience','startup')),
  applicant_name text not null,
  phone          text,
  email          text,
  preferred_date date,
  title          text,
  body           text,
  link           text,
  status         text not null default 'received'
                 check (status in ('received','reviewing','accepted','rejected','done')),
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. 예산·정산
-- ---------------------------------------------------------------------------
create table if not exists public.budget_items (
  id         bigserial primary key,
  category   text not null,          -- 예: [3] K-미식·야간관광 콘텐츠
  unit_code  text,                   -- 예: [3]-2
  name       text not null,
  semok      text,                   -- 일반용역비 | 임차료 | 보수 ...
  planned    int not null default 0, -- 천원
  spent      int not null default 0, -- 천원
  basis      text,
  note       text,
  sort_order int not null default 999,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. 지침·서식 자료실
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id          bigserial primary key,
  category    text not null default 'etc'   -- guide | form | submit | council | etc
              check (category in ('guide','form','submit','council','etc')),
  title       text not null,
  description text,
  file_path   text,
  file_name   text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  RLS 정책
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.events        enable row level security;
alter table public.shops         enable row level security;
alter table public.applications  enable row level security;
alter table public.budget_items  enable row level security;
alter table public.documents     enable row level security;

-- ----- profiles -----
drop policy if exists p_self_read   on public.profiles;
drop policy if exists p_self_write  on public.profiles;
drop policy if exists p_self_upsert on public.profiles;
drop policy if exists p_staff_read  on public.profiles;
drop policy if exists p_admin_write on public.profiles;

create policy p_self_read   on public.profiles for select using (auth.uid() = id);
create policy p_staff_read  on public.profiles for select using (public.is_staff());
create policy p_self_upsert on public.profiles for insert with check (auth.uid() = id);
create policy p_self_write  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy p_admin_write on public.profiles for update using (public.is_admin());

-- ----- 공개 콘텐츠 (posts / events / shops) -----
drop policy if exists c_pub_posts  on public.posts;
drop policy if exists c_stf_posts  on public.posts;
create policy c_pub_posts on public.posts for select using (published = true or public.is_staff());
create policy c_stf_posts on public.posts for all    using (public.is_staff()) with check (public.is_staff());

drop policy if exists c_pub_events on public.events;
drop policy if exists c_stf_events on public.events;
create policy c_pub_events on public.events for select using (published = true or public.is_staff());
create policy c_stf_events on public.events for all    using (public.is_staff()) with check (public.is_staff());

drop policy if exists c_pub_shops  on public.shops;
drop policy if exists c_stf_shops  on public.shops;
create policy c_pub_shops on public.shops for select using (published = true or public.is_staff());
create policy c_stf_shops on public.shops for all    using (public.is_staff()) with check (public.is_staff());

-- ----- applications : 누구나 접수, 본인/스태프만 열람 -----
drop policy if exists a_insert     on public.applications;
drop policy if exists a_own_read   on public.applications;
drop policy if exists a_staff_all  on public.applications;
create policy a_insert    on public.applications for insert with check (true);
create policy a_own_read  on public.applications for select using (auth.uid() = user_id);
create policy a_staff_all on public.applications for all    using (public.is_staff()) with check (public.is_staff());

-- ----- 사업 관리 : 스태프 전용 -----
drop policy if exists b_staff on public.budget_items;
create policy b_staff on public.budget_items for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists d_staff on public.documents;
create policy d_staff on public.documents for all using (public.is_staff()) with check (public.is_staff());

-- ============================================================================
--  Storage : 자료실 버킷 (대시보드에서 'docs' 비공개 버킷 생성 후 실행)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('docs', 'docs', false)
on conflict (id) do nothing;

drop policy if exists s_docs_read  on storage.objects;
drop policy if exists s_docs_write on storage.objects;
create policy s_docs_read  on storage.objects for select
  using (bucket_id = 'docs' and public.is_staff());
create policy s_docs_write on storage.objects for all
  using (bucket_id = 'docs' and public.is_staff())
  with check (bucket_id = 'docs' and public.is_staff());

-- ============================================================================
--  예산 시드 데이터 — 최종 운영계획서 기준 (총 276,000천원)
--  직접비 234,600 (임차료 37,000 + 일반용역비 197,600) / 간접비 41,400
-- ============================================================================
truncate table public.budget_items restart identity;

insert into public.budget_items (category, unit_code, name, semok, planned, basis, sort_order) values
-- [1] 상권 브랜드·경관 조성 (61,500)
('[1] 상권 브랜드·경관 조성','[1]-1','용마미식거리 골목상권 브랜드(BI) 개발 · 홈페이지 제작(다국어 한·영·중)','일반용역비',15000,'15,000천원 × 1식',101),
('[1] 상권 브랜드·경관 조성','[1]-2','상권 진입 아치 리모델링','일반용역비',15000,'15,000천원 × 1식',102),
('[1] 상권 브랜드·경관 조성','[1]-3','거리환경 조성 — 감성조명(바닥 유도조명 포함)','일반용역비',19000,'19,000천원 × 1식',103),
('[1] 상권 브랜드·경관 조성','[1]-3','거리환경 조성 — 음향시스템 설치','일반용역비',5000,'5,000천원 × 1식',104),
('[1] 상권 브랜드·경관 조성','[1]-4','벽화 포토존 조성','일반용역비',7500,'2,500천원 × 3개소',105),
-- [2] 상권 인프라·안전 조성 (43,000)
('[2] 상권 인프라·안전 조성','[2]-1','용마 바람길 — 레트로 파라솔 임차','임차료',6000,'100천원 × 20개 × 3개월',201),
('[2] 상권 인프라·안전 조성','[2]-1','용마 바람길 — 미스트·냉방설비 임차','임차료',12000,'500천원 × 8개소 × 3개월',202),
('[2] 상권 인프라·안전 조성','[2]-1','용마 바람길 — 몽골텐트 임차','임차료',9000,'300천원 × 10동 × 3개월',203),
('[2] 상권 인프라·안전 조성','[2]-2','복합 게이트웨이 — 상권안내소·오픈형 랙','일반용역비',7000,'7,000천원 × 1식',204),
('[2] 상권 인프라·안전 조성','[2]-2','복합 게이트웨이 — 유인 물품보관 오픈랙','일반용역비',3000,'3,000천원 × 1식',205),
('[2] 상권 인프라·안전 조성','[2]-3','상권 안전관리 요원 배치','일반용역비',6000,'150천원 × 8인 × 5회',206),
-- [3] K-미식·야간관광 콘텐츠 (75,100)
('[3] K-미식·야간관광 콘텐츠','[3]-1','용마노포길 K-미식벨트 부스·집기 임차','임차료',10000,'1,000천원 × 10개소',301),
('[3] K-미식·야간관광 콘텐츠','[3]-1','용마노포길 K-미식벨트 — 로컬 노포 미식맵 제작','일반용역비',3000,'3,000천원 × 1식',302),
('[3] K-미식·야간관광 콘텐츠','[3]-2','골목어게인 버스킹 공연','일반용역비',14100,'940천원 × 15회',303),
('[3] K-미식·야간관광 콘텐츠','[3]-2','골목어게인 DJ 음악다방·거리노래방','일반용역비',15000,'1,000천원 × 15회',304),
('[3] K-미식·야간관광 콘텐츠','[3]-3','K-컬처 기획공연 (동행축제 연계)','일반용역비',23000,'23,000천원 × 1식',305),
('[3] K-미식·야간관광 콘텐츠','[3]-4','놀아존 체험·참여 콘텐츠 운영','일반용역비',7000,'1,750천원 × 4회',306),
('[3] K-미식·야간관광 콘텐츠','[3]-5','한번봐존 프리마켓 운영','일반용역비',3000,'500천원 × 6회',307),
-- [4] 로컬창업 생태계·상인역량강화 (21,000)
('[4] 로컬창업 생태계·상인역량강화','[4]-1','로컬창업 생태계 — 창업 멘토링 강사료','일반용역비',2000,'250천원/시간 × 2시간 × 4회',401),
('[4] 로컬창업 생태계·상인역량강화','[4]-1','로컬창업 생태계 — 핵점포 상품개발 컨설팅','일반용역비',10000,'2,500천원 × 4개소',402),
('[4] 로컬창업 생태계·상인역량강화','[4]-2','상인 역량강화 교육 강사료','일반용역비',3000,'250천원/시간 × 2시간 × 6회',403),
('[4] 로컬창업 생태계·상인역량강화','[4]-2','상인 역량강화 교육 교재 제작','일반용역비',1000,'10천원 × 50부 × 2회',404),
('[4] 로컬창업 생태계·상인역량강화','[4]-3','상권 소비촉진 온누리상품권 리워드','일반용역비',5000,'5천원권 900매 + 운영관리',405),
('[4] 로컬창업 생태계·상인역량강화','[4]-4','임대인 상생협약 체결 (상권기획자 직접수행)','기타',0,'예산 미편성',406),
-- [5] 통합 마케팅·홍보 (34,000)
('[5] 통합 마케팅·홍보','[5]-1','인플루언서 콘텐츠 제작 — 롱폼 영상','일반용역비',12000,'2,000천원 × 6편',501),
('[5] 통합 마케팅·홍보','[5]-1','인플루언서 콘텐츠 제작 — 숏폼','일반용역비',9000,'900천원 × 10편',502),
('[5] 통합 마케팅·홍보','[5]-2','멀티채널 마케팅·홍보 (통합 홍보물 제작·숏폼 아카이빙)','일반용역비',13000,'13,000천원 × 1식',503),
-- 간접사업비 (41,400)
('간접사업비 — 인건비',null,'PM (책임연구원)','보수',10500,'1,750천원 × 1명 × 6개월 × 100%',601),
('간접사업비 — 인건비',null,'PL (연구원)','보수',8100,'1,350천원 × 1명 × 6개월 × 100%',602),
('간접사업비 — 인건비',null,'운영인력 (연구보조원)','보수',6300,'1,050천원 × 1명 × 6개월 × 100%',603),
('간접사업비 — 인건비',null,'4대보험 회사부담금','보수',2814,'급여 소계 24,900천원 × 11.30%',604),
('간접사업비 — 인건비',null,'퇴직급여충당금','보수',2074,'급여 소계 24,900천원 × 8.33%',605),
('간접사업비 — 운영비',null,'지급수수료 (예산집행 모니터링·회계감사)','일반수용비',2700,'2,700천원 × 1식',611),
('간접사업비 — 운영비',null,'소모품비 (사무용품 등)','일반수용비',1800,'300천원 × 6개월',612),
('간접사업비 — 운영비',null,'특근매식비','일반수용비',1200,'10천원 × 20인 × 6회',613),
('간접사업비 — 운영비',null,'공공요금 및 제세','일반수용비',600,'100천원 × 6개월',614),
('간접사업비 — 운영비',null,'이행(지급)보증보험증권 발급수수료','일반수용비',792,'792천원 × 1식',615),
('간접사업비 — 여비',null,'국내여비 — 시내출장 (상권 현장관리)','여비',720,'30천원 × 2인 × 12회',621),
('간접사업비 — 여비',null,'국내여비 — 시외출장 (공단·중기부 회의)','여비',1500,'250천원 × 2인 × 3회',622),
('간접사업비 — 업무추진비',null,'사업협의회(거버넌스) 간담회','업무추진비',900,'15천원 × 10인 × 6회',631),
('간접사업비 — 업무추진비',null,'상인 간담회','업무추진비',600,'10천원 × 10인 × 6회',632),
('간접사업비 — 업무추진비',null,'착수·완료 보고회','업무추진비',800,'20천원 × 20인 × 2회',633);

-- 검산 : 아래 쿼리는 276000 이 나와야 합니다.
-- select sum(planned) from public.budget_items;

-- ============================================================================
--  최초 관리자 지정
--  회원가입을 먼저 한 뒤, 아래 이메일을 본인 것으로 바꿔 실행하십시오.
-- ============================================================================
-- update public.profiles set role = 'admin' where email = 'stnhub210@gmail.com';
