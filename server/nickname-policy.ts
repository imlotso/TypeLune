import type { FastifyInstance } from "fastify";
import type { AsyncDatabase } from "./database/types.js";
import type { AdminActor, createAdminAudit } from "./admin.js";
import seed from "./data/nickname-wordlists.json" with { type: "json" };
import {
  compileNicknamePolicy,
  nicknamePolicyError,
  type NicknamePolicy,
  type NicknamePolicySnapshot,
} from "../src/lib/nickname-policy.js";
export const nicknamePolicySchema =
  "CREATE TABLE IF NOT EXISTS nickname_policy(id INTEGER PRIMARY KEY CHECK(id=1),settings TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0));";
export const defaultNicknamePolicy: NicknamePolicy = {
  enabled: false,
  languages: [],
  packs: seed.packs as NicknamePolicy["packs"],
};
export const nicknameBlockedMessage = "昵称含有不允许使用的词，请更换昵称";
export async function createNicknamePolicy(
  db: AsyncDatabase,
  audit: ReturnType<typeof createAdminAudit>,
) {
  if (db.dialect === "sqlite") await db.exec(nicknamePolicySchema);
  const available = async () =>
    db.dialect === "sqlite" ||
    !!(await db.prepare("SELECT to_regclass('nickname_policy') AS name").get())
      ?.name;
  let cached: NicknamePolicySnapshot | undefined;
  let match = compileNicknamePolicy(defaultNicknamePolicy);
  async function read(): Promise<NicknamePolicySnapshot> {
    if (!(await available())) {
      cached = undefined;
      match = compileNicknamePolicy(defaultNicknamePolicy);
      return { settings: defaultNicknamePolicy, revision: 0 };
    }
    const revision = await db
      .prepare("SELECT revision FROM nickname_policy WHERE id=1")
      .get();
    if (cached && cached.revision === (revision?.revision ?? 0)) return cached;
    const row = revision
      ? await db
          .prepare("SELECT settings,revision FROM nickname_policy WHERE id=1")
          .get()
      : undefined;
    const value: NicknamePolicySnapshot = row
      ? { settings: JSON.parse(row.settings), revision: row.revision }
      : { settings: defaultNicknamePolicy, revision: 0 };
    if (nicknamePolicyError(value.settings))
      throw Error("Invalid stored nickname policy");
    cached = value;
    match = compileNicknamePolicy(value.settings);
    return value;
  }
  const update = db.transaction(
    async (actor: AdminActor, settings: NicknamePolicy, revision: number) => {
      const admin = await db
        .prepare(
          "SELECT auth_version FROM users WHERE id=? AND role='admin' AND disabled_at IS NULL",
        )
        .get(actor.id);
      if (!admin || Number(admin.auth_version) !== actor.authVersion)
        throw Error("ADMIN_REVOKED");
      const old = await read();
      if (old.revision !== revision) return null;
      if (JSON.stringify(settings) === JSON.stringify(old.settings)) return old;
      await db
        .prepare(
          "INSERT INTO nickname_policy(id,settings,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision",
        )
        .run(JSON.stringify(settings), revision + 1);
      await audit(
        actor,
        "settings.nickname.update",
        "setting",
        "nickname",
        "昵称过滤",
        `更新昵称词包与启用设置（中文 ${settings.packs.zh.length}，英文 ${settings.packs.en.length}）`,
      );
      cached = undefined;
      return read();
    },
  );
  return {
    available,
    read,
    update: update.immediate,
    async blocked(name: string) {
      await read();
      return !!match(name);
    },
  };
}
export function registerNicknamePolicyAdmin(
  app: FastifyInstance,
  store: Awaited<ReturnType<typeof createNicknamePolicy>>,
) {
  app.get("/nicknames", async (_request, reply) => {
    if (!(await store.available()))
      return reply.code(503).send({ error: "昵称词库存储尚未安装" });
    return store.read();
  });
  app.post("/nicknames", { bodyLimit: 1_100_000 }, async (request, reply) => {
    if (!(await store.available()))
      return reply.code(503).send({ error: "昵称词库存储尚未安装" });
    const body = request.body as {
      settings?: unknown;
      revision?: unknown;
    } | null;
    if (
      !body ||
      !Number.isSafeInteger(body.revision) ||
      Number(body.revision) < 0
    )
      return reply.code(400).send({ error: "昵称过滤设置无效" });
    const error = nicknamePolicyError(body.settings);
    if (error) return reply.code(400).send({ error });
    try {
      const saved = await store.update(
        request.admin,
        body.settings as NicknamePolicy,
        body.revision as number,
      );
      return saved ?? reply.code(409).send({ error: "设置已更新，请重新加载" });
    } catch (error) {
      if (error instanceof Error && error.message === "ADMIN_REVOKED")
        return reply.code(403).send({ error: "没有管理权限" });
      throw error;
    }
  });
}
