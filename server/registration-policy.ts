import { domainToASCII } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isValidEmail } from '../src/lib/account-validation.js';
import type { RegistrationPolicy, RegistrationPolicySnapshot } from '../src/lib/registration-policy.js';
import type { AdminActor, createAdminAudit } from './admin.js';
import type { AsyncDatabase } from './database/types.js';

export const registrationPolicyTable = 'registration_policy';
export const registrationPolicySchema = `CREATE TABLE IF NOT EXISTS ${registrationPolicyTable} (
  id BIGINT NOT NULL PRIMARY KEY CHECK (id=1), settings TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision>0)
);`;
export const emptyRegistrationPolicy: RegistrationPolicy = {
  allowedDomains: [],
  deniedDomains: [],
  deniedEmails: [],
};

function canonicalDomain(value: string) {
  if (!/^[\p{L}\p{M}\p{N}.\u3002\uFF0E\uFF61-]+$/u.test(value)) return '';
  const domain = domainToASCII(value).toLowerCase();
  const labels = domain.split('.');
  return domain.length <= 253 && labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ? domain : '';
}

function canonicalAddress(value: string) {
  const address = value.trim().toLowerCase();
  if (!isValidEmail(address) || /[\p{Cc}\p{Cf}]/u.test(address)) return '';
  const [local, domain] = address.split('@');
  const canonical = canonicalDomain(domain);
  return canonical && `${local}@${canonical}`.length <= 254 ? `${local}@${canonical}` : '';
}

const domainEntry = z.string().trim().max(254).transform((value) => canonicalDomain(value.replace(/^[@.]/, ''))).refine(Boolean);
const emailEntry = z.string().trim().max(254).transform(canonicalAddress).refine(Boolean);
const normalizeList = (entries: string[]) => [...new Set(entries)].sort();

const policy = z.strictObject({
  allowedDomains: z.array(domainEntry).max(200).transform(normalizeList),
  deniedDomains: z.array(domainEntry).max(200).transform(normalizeList),
  deniedEmails: z.array(emailEntry).max(200).transform(normalizeList),
});
const payload = z.strictObject({ settings: policy, revision: z.number().int().nonnegative() });

export function registrationDenial(enabled: boolean, policy: RegistrationPolicy, email: string) {
  if (!enabled) return '当前已关闭注册';
  const domain = canonicalDomain(email.split('@')[1] ?? '');
  const matches = (entry: string) => domain === entry || domain.endsWith(`.${entry}`);
  if (policy.deniedEmails.includes(canonicalAddress(email)) || policy.deniedDomains.some(matches) ||
    (policy.allowedDomains.length > 0 && !policy.allowedDomains.some(matches))) {
    return '此邮箱不符合注册规则';
  }
}

export async function createRegistrationPolicy(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>) {
  if (db.dialect === 'sqlite') await db.exec(registrationPolicySchema);
  let installed = db.dialect === 'sqlite';
  const select = db.prepare(`SELECT settings,revision FROM ${registrationPolicyTable} WHERE id=1`);
  const save = db.prepare(`INSERT INTO ${registrationPolicyTable}(id,settings,revision) VALUES(1,?,?)
    ON CONFLICT(id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision`);

  async function available() {
    if (!installed) installed = !!(await db.prepare(`SELECT to_regclass('${registrationPolicyTable}') AS name`).get())?.name;
    return installed;
  }

  async function read(): Promise<RegistrationPolicySnapshot> {
    const row = await available() ? await select.get() as { settings: string; revision: number } | undefined : undefined;
    return row ? { settings: policy.parse(JSON.parse(row.settings)), revision: row.revision }
      : { settings: emptyRegistrationPolicy, revision: 0 };
  }

  const update = db.transaction(async (actor: AdminActor, { settings, revision }: z.output<typeof payload>) => {
    const previous = await read();
    if (previous.revision !== revision) return null;
    if (JSON.stringify(previous.settings) === JSON.stringify(settings)) return previous;

    const nextRevision = revision + 1;
    await save.run(JSON.stringify(settings), nextRevision);
    await audit(actor, 'settings.registration.update', 'setting', 'registration', '注册邮箱规则', null);
    return { settings, revision: nextRevision };
  });

  return { available, read, update: update.immediate };
}

export function registerRegistrationPolicyAdmin(app: FastifyInstance, store: Awaited<ReturnType<typeof createRegistrationPolicy>>) {
  const path = '/users/registration-policy';
  const storageUnavailable = '注册邮箱规则存储尚未安装';
  app.get(path, async (_request, reply) => {
    if (!await store.available()) return reply.code(503).send({ error: storageUnavailable });
    return store.read();
  });
  app.post(path, async (request, reply) => {
    if (!await store.available()) return reply.code(503).send({ error: storageUnavailable });
    const parsed = payload.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '邮箱规则无效，请检查域名、邮箱及条目数量' });
    const updated = await store.update(request.admin, parsed.data);
    if (!updated) return reply.code(409).send({ error: '注册规则已更新，请重新加载' });
    return updated;
  });
}
