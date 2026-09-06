-- Active-scene changes must reach every campaign member so their table can
-- leave the old scene channel and join the newly active one automatically.
alter publication supabase_realtime add table public.scenes;
