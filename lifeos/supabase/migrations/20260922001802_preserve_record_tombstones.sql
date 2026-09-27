-- Tracker deletions are retained as tombstones so an offline cache cannot
-- restore an older copy after reconnecting.
drop policy if exists records_delete_own on public.records;
revoke delete on table public.records from authenticated;
notify pgrst,'reload schema';
