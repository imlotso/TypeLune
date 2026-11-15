-- Optional, additive support configuration extension.
-- Run explicitly against the selected database/schema, never during application startup.
-- Keeps immutable schema 1/2 migration records unchanged, so old applications can roll back.
CREATE TABLE IF NOT EXISTS support_settings (
  id BIGINT PRIMARY KEY CHECK(id=1),
  settings TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK(revision>0)
);
