-- Optional, additive SEO configuration extension.
-- Install explicitly against the confirmed database/schema, never on application startup.
-- Independent from site_settings and immutable migrations, so older applications can ignore it.
CREATE TABLE IF NOT EXISTS seo_settings (
  id BIGINT PRIMARY KEY CHECK(id=1),
  settings TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK(revision>0)
);
