-- Tracker profile settings are separate from account identity in public.profiles.
alter table public.records drop constraint records_collection_check;
alter table public.records add constraint records_collection_check check (collection in ('profile','logs','prayers','quran','finance','loans','recurring','checkins','goals','skills','education','notes','journal','mission','courses','adhkar','jumuah','ramadan','trades'));
notify pgrst,'reload schema';
