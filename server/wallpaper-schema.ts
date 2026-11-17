export const wallpaperTables = ['wallpaper_settings', 'wallpaper_rotation', 'background_files', 'background_upload_chunks'] as const;
// Additive optional extension; installed explicitly on PostgreSQL.
export const wallpaperSchema = `CREATE TABLE IF NOT EXISTS wallpaper_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0)
);
CREATE TABLE IF NOT EXISTS wallpaper_rotation (
  id INTEGER PRIMARY KEY CHECK(id=1), config_revision INTEGER NOT NULL DEFAULT 0,
  slot BIGINT NOT NULL DEFAULT -1, background TEXT, token TEXT,
  lease_until BIGINT NOT NULL DEFAULT 0, retry_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS background_files (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  digest TEXT NOT NULL, bytes BYTEA NOT NULL, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS background_files_owner ON background_files(user_id);
CREATE TABLE IF NOT EXISTS background_upload_chunks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, upload_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, chunk_count INTEGER NOT NULL, total_bytes INTEGER NOT NULL,
  name TEXT NOT NULL, mime TEXT NOT NULL, digest TEXT NOT NULL,
  bytes BYTEA NOT NULL, created_at BIGINT NOT NULL,
  PRIMARY KEY(user_id,upload_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS background_upload_expiry ON background_upload_chunks(created_at);
`;
