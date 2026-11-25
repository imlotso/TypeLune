-- Optional, additive site default appearance & theme configuration extension.
-- Keeps immutable schema 1/2 migration records unchanged.
CREATE TABLE IF NOT EXISTS appearance_settings (
  id BIGINT PRIMARY KEY CHECK(id=1),
  settings TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK(revision>0)
);
