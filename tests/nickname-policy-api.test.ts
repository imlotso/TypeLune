import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import type { NicknamePolicySnapshot } from "../src/lib/nickname-policy";
describe("administrator nickname policy with real account and leaderboard enforcement", () => {
  let app: Awaited<ReturnType<typeof createApp>>,
    other: typeof app,
    dir: string,
    db: Database.Database,
    time: number,
    admin: Record<string, string>,
    member: Record<string, string>,
    memberId: string;
  const codes = new Map<string, string>();
  const password = "test-password-123";
  const open = () =>
    createApp({
      databasePath: join(dir, "db.sqlite"),
      secureCookies: false,
      adminEmail: "owner@example.test",
      now: () => time,
      mailer: {
        async sendCode(email, code) {
          codes.set(email, code);
        },
      },
    });
  const post = (
    url: string,
    payload: object,
    headers?: Record<string, string>,
  ) => app.inject({ method: "POST", url, payload, headers });
  async function register(name: string) {
    const email = name + "@example.test";
    await post("/api/auth/code", { email, purpose: "register" });
    const r = await post("/api/auth/register", {
      email,
      username: name,
      password,
      code: codes.get(email),
    });
    expect(r.statusCode).toBe(200);
    return {
      id: r.json().user.id,
      headers: {
        cookie: "session=" + r.cookies[0].value,
        "x-workspace-owner": r.json().user.id,
      },
    };
  }
  const read = async () =>
    (
      await app.inject({ url: "/api/admin/nicknames", headers: admin })
    ).json<NicknamePolicySnapshot>();
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "nickname-policy-"));
    time = 1800000000000;
    codes.clear();
    app = await open();
    const a = await register("owner"),
      u = await register("reader");
    admin = a.headers;
    member = u.headers;
    memberId = u.id;
    db = new Database(join(dir, "db.sqlite"));
  });
  afterEach(async () => {
    await other?.close();
    other = undefined as never;
    db?.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  async function finishedGuest() {
    const start = await post("/api/tests/start", {
      articleId: "zh-beginner-1",
      duration: 60,
    });
    expect(start.statusCode).toBe(200);
    const headers = {
      cookie: "guest=" + start.cookies.find((c) => c.name === "guest")!.value,
    };
    time += 60000;
    expect(
      (
        await post(
          "/api/tests/" + start.json().id + "/finish",
          { typed: "我" },
          headers,
        )
      ).statusCode,
    ).toBe(200);
    return { id: start.json().id, headers };
  }
  it("protects settings, validates imports, resolves concurrent writes, retains deletion and audits metadata only", async () => {
    expect((await app.inject("/api/admin/nicknames")).statusCode).toBe(403);
    expect(
      (await app.inject({ url: "/api/admin/nicknames", headers: member }))
        .statusCode,
    ).toBe(403);
    const initial = await read();
    expect(initial.settings.enabled).toBe(false);
    expect(initial.settings.languages).toEqual([]);
    expect(
      (
        await post(
          "/api/admin/nicknames",
          {
            revision: initial.revision,
            settings: { ...initial.settings, enabled: true },
          },
          admin,
        )
      ).statusCode,
    ).toBe(400);
    const updates = await Promise.all([
      post(
        "/api/admin/nicknames",
        { revision: 0, settings: { ...initial.settings, languages: ["zh"] } },
        admin,
      ),
      post(
        "/api/admin/nicknames",
        { revision: 0, settings: { ...initial.settings, languages: ["en"] } },
        admin,
      ),
    ]);
    expect(updates.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await read();
    expect(
      (
        await post(
          "/api/admin/nicknames",
          {
            revision: current.revision,
            settings: {
              enabled: false,
              languages: [],
              packs: { zh: [], en: [] },
            },
          },
          admin,
        )
      ).statusCode,
    ).toBe(200);
    other = await open();
    expect(
      (
        await other.inject({ url: "/api/admin/nicknames", headers: admin })
      ).json().settings.packs,
    ).toEqual({ zh: [], en: [] });
    const audit = (
      await app.inject({ url: "/api/admin/audit", headers: admin })
    ).json();
    expect(JSON.stringify(audit)).toContain("settings.nickname.update");
    expect(JSON.stringify(audit)).not.toContain(
      initial.settings.packs.en[0].term,
    );
  });
  it("rejects guest suffixes before publication, permits retry and reflects changes across application instances", async () => {
    other = await open();
    const initial = await read(),
      attempt = await finishedGuest();
    const enabled = { ...initial.settings, enabled: true, languages: ["en"] };
    expect(
      (
        await post(
          "/api/admin/nicknames",
          { revision: 0, settings: enabled },
          admin,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await other.inject({
          method: "POST",
          url: "/api/leaderboard",
          headers: attempt.headers,
          payload: { attemptId: attempt.id, nickname: "visitorFUCK" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      db.prepare("SELECT published FROM challenges WHERE id=?").get(attempt.id),
    ).toMatchObject({ published: 0 });
    expect(
      (
        await post(
          "/api/leaderboard",
          { attemptId: attempt.id, nickname: "visitor小云" },
          attempt.headers,
        )
      ).statusCode,
    ).toBe(200);
    const second = await finishedGuest();
    expect(
      (
        await post(
          "/api/admin/nicknames",
          { revision: 1, settings: { ...enabled, enabled: false } },
          admin,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await other.inject({
          method: "POST",
          url: "/api/leaderboard",
          headers: second.headers,
          payload: { attemptId: second.id, nickname: "visitorfuck" },
        })
      ).statusCode,
    ).toBe(200);
  });
  it("enforces changed account display names and registration while preserving login and unrelated profile changes", async () => {
    const initial = await read();
    await post(
      "/api/admin/nicknames",
      {
        revision: 0,
        settings: { ...initial.settings, enabled: true, languages: ["en"] },
      },
      admin,
    );
    expect(
      (await post("/api/account/profile", { displayName: "fuck" }, member))
        .statusCode,
    ).toBe(400);
    const email = "clean@example.test";
    await post("/api/auth/code", { email, purpose: "register" });
    const bad = await post("/api/auth/register", {
      email,
      username: "fuck",
      password,
      code: codes.get(email),
    });
    expect(bad.statusCode).toBe(400);
    expect(
      (
        await post("/api/auth/register", {
          email,
          username: "clean",
          password,
          code: codes.get(email),
        })
      ).statusCode,
    ).toBe(200);
    db.prepare("UPDATE users SET display_name=? WHERE id=?").run(
      "fuck",
      memberId,
    );
    expect(
      (
        await post(
          "/api/account/profile",
          { displayName: "fuck", avatar: null },
          member,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await post("/api/auth/login", { identifier: "reader", password }))
        .statusCode,
    ).toBe(200);
  });
});
