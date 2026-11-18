import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import {
  nicknamePolicySchema,
  defaultNicknamePolicy,
} from "../server/nickname-policy";
import { PostgresDatabase } from "../server/postgres/database";
import { AsyncPostgres } from "../server/database/postgres";
import { migratePostgres } from "../server/postgres/migrate";
import { bootstrapPostgresAdmin } from "../server/postgres/bootstrap";
const url = process.env.DAZI_TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  "nickname policies on real PostgreSQL with explicit installation",
  () => {
    let client: pg.Client,
      schema: string,
      db: PostgresDatabase,
      app: Awaited<ReturnType<typeof createApp>>,
      second: typeof app,
      owner: string,
      headers: Record<string, string>;
    beforeAll(async () => {
      const parsed = new URL(url!);
      if (
        !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        !/test/i.test(parsed.pathname)
      )
        throw Error("Disposable loopback test database required");
      schema = "nickname_test_" + randomBytes(6).toString("hex");
      client = new pg.Client({ connectionString: url });
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await migratePostgres(client, {
        database: parsed.pathname.slice(1),
        schema,
      });
      db = new PostgresDatabase(url!, schema);
      owner = await bootstrapPostgresAdmin(
        new AsyncPostgres(db),
        "PolicyAdmin",
        "policy@example.test",
        "isolated-password-123",
      );
      app = await createApp({
        databaseUrl: url,
        postgresSchema: schema,
        codeSecret: "test-only-secret-value-at-least-32-characters",
        secureCookies: false,
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          identifier: "PolicyAdmin",
          password: "isolated-password-123",
        },
      });
      expect(login.statusCode).toBe(200);
      headers = {
        cookie: "session=" + login.cookies[0].value,
        "x-workspace-owner": owner,
      };
    }, 30000);
    afterAll(async () => {
      await second?.close();
      await app?.close();
      await db?.close();
      if (client) {
        await client.query("SET search_path TO public");
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        await client.end();
      }
    });
    it("keeps runtime DDL absent and additively seeds disabled defaults without overwriting administrator choices", async () => {
      expect(
        (await app.inject({ url: "/api/admin/nicknames", headers })).statusCode,
      ).toBe(503);
      await expect(db.verifySchema()).resolves.toBeUndefined();
      const before = (
        await client.query(
          "SELECT version,checksum FROM dazi_schema_migrations ORDER BY version",
        )
      ).rows;
      await client.query(nicknamePolicySchema);
      const seed = () =>
        client.query(
          "INSERT INTO nickname_policy(id,settings,revision) VALUES(1,$1,1) ON CONFLICT(id) DO NOTHING",
          [JSON.stringify(defaultNicknamePolicy)],
        );
      await seed();
      let snapshot = (
        await app.inject({ url: "/api/admin/nicknames", headers })
      ).json();
      expect(snapshot.settings.enabled).toBe(false);
      expect(snapshot.settings.languages).toEqual([]);
      const enabled = {
        ...snapshot.settings,
        enabled: true,
        languages: ["en"],
      };
      const update = () =>
        app.inject({
          method: "POST",
          url: "/api/admin/nicknames",
          headers,
          payload: { revision: 1, settings: enabled },
        });
      expect(
        (await Promise.all([update(), update()]))
          .map((r) => r.statusCode)
          .sort(),
      ).toEqual([200, 409]);
      await seed();
      snapshot = (
        await app.inject({ url: "/api/admin/nicknames", headers })
      ).json();
      expect(snapshot.revision).toBe(2);
      expect(snapshot.settings.enabled).toBe(true);
      second = await createApp({
        databaseUrl: url,
        postgresSchema: schema,
        codeSecret: "test-only-secret-value-at-least-32-characters",
        secureCookies: false,
      });
      expect(
        (await second.inject({ url: "/api/admin/nicknames", headers })).json(),
      ).toEqual(snapshot);
      expect(
        (
          await client.query(
            "SELECT version,checksum FROM dazi_schema_migrations ORDER BY version",
          )
        ).rows,
      ).toEqual(before);
      const stale = await app.inject({
        method: "POST",
        url: "/api/admin/nicknames",
        headers,
        payload: { revision: 1, settings: defaultNicknamePolicy },
      });
      expect(stale.statusCode).toBe(409);
      const unauthorized = await app.inject({
        method: "POST",
        url: "/api/admin/nicknames",
        payload: { revision: 2, settings: defaultNicknamePolicy },
      });
      expect(unauthorized.statusCode).toBe(403);
    });
  },
);
