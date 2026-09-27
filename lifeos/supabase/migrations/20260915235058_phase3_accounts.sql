create table public.profiles (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=60),
 timezone text not null default 'Asia/Karachi' check(char_length(timezone) between 1 and 100),
 currency text not null default 'PKR' check(currency ~ '^[A-Z]{3}$'),
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.records (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 collection text not null check(collection in ('logs','prayers','quran','finance','loans','recurring','checkins','goals','skills','education','notes','journal','mission','courses','adhkar','jumuah','ramadan','trades')),
 record_key text not null check(char_length(record_key) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
 revision bigint not null default 1 check(revision>0),
 deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,collection,record_key)
);
create index records_user_updated on public.records(user_id,updated_at,collection,record_key);
create function public.lifeos_stamp_row() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then NEW.created_at:=clock_timestamp(); NEW.revision:=1;
 else
  if NEW.user_id<>OLD.user_id then raise exception 'Ownership cannot change' using errcode='42501'; end if;
  NEW.created_at:=OLD.created_at; NEW.revision:=OLD.revision+1;
  if TG_TABLE_NAME='records' then
   if NEW.collection<>OLD.collection or NEW.record_key<>OLD.record_key then raise exception 'Record identity cannot change' using errcode='22023'; end if;
  end if;
 end if;
 if TG_TABLE_NAME='profiles' then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=NEW.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 end if;
 NEW.updated_at:=clock_timestamp(); return NEW;
end;
$$;
revoke all on function public.lifeos_stamp_row() from public,anon,authenticated;
create trigger profiles_stamp before insert or update on public.profiles for each row execute function public.lifeos_stamp_row();
create trigger records_stamp before insert or update on public.records for each row execute function public.lifeos_stamp_row();
alter table public.profiles enable row level security;
alter table public.records enable row level security;
revoke all on public.profiles,public.records from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.records to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid())=user_id) ;
create policy profiles_insert_own on public.profiles for insert to authenticated  with check ((select auth.uid())=user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid())=user_id) ;
create policy records_select_own on public.records for select to authenticated using ((select auth.uid())=user_id) ;
create policy records_insert_own on public.records for insert to authenticated  with check ((select auth.uid())=user_id);
create policy records_update_own on public.records for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy records_delete_own on public.records for delete to authenticated using ((select auth.uid())=user_id) ;
notify pgrst,'reload schema';
