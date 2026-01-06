-- Migration 46: Keep Alive Table
-- Prevents Supabase from pausing the project due to inactivity
-- A cron job will ping this table every few days

CREATE TABLE IF NOT EXISTS keep_alive (
  id SERIAL PRIMARY KEY,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'vercel_cron', -- where the ping came from
  metadata JSONB DEFAULT '{}'::jsonb -- any extra info
);

-- Only keep last 30 pings to avoid table bloat
CREATE OR REPLACE FUNCTION cleanup_keep_alive()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM keep_alive 
  WHERE id NOT IN (
    SELECT id FROM keep_alive 
    ORDER BY pinged_at DESC 
    LIMIT 30
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER keep_alive_cleanup_trigger
AFTER INSERT ON keep_alive
EXECUTE FUNCTION cleanup_keep_alive();

-- Allow authenticated users to insert (for the API route)
ALTER TABLE keep_alive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert keep_alive"
ON keep_alive FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service can read keep_alive"
ON keep_alive FOR SELECT
TO authenticated
USING (true);

COMMENT ON TABLE keep_alive IS 'Prevents Supabase project from being paused due to inactivity. Pinged via Vercel cron job.';
