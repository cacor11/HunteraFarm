CREATE TABLE IF NOT EXISTS installations (
  installation_id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'windows')),
  version TEXT NOT NULL CHECK (length(version) BETWEEN 1 AND 32),
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  CHECK (last_seen >= first_seen)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_installations_last_seen
ON installations(last_seen);

CREATE INDEX IF NOT EXISTS idx_installations_first_seen
ON installations(first_seen);

PRAGMA optimize;

