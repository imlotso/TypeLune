import { createHash } from 'node:crypto';
import type { PracticeRecord, WorkspaceItem } from '../../src/lib/models.js';
import { isProcessTrace } from '../../src/lib/process-trace.js';
import { stableRecordId, type LegacyRecordProof } from '../../src/lib/records.js';
import { newerWorkspaceItems } from '../../src/lib/workspace.js';
import { WorkspaceChangedError, WorkspaceClientUpdateRequiredError, WorkspaceConflictError, WorkspaceCursorError, WorkspaceGenerationError, WorkspaceLimitError, WorkspacePageSizeError } from '../workspace.js';
import type { AsyncDatabase } from './types.js';

const maxWorkspaceItems = 2000;
const maxWorkspaceBytes = 32 * 1024 * 1024;
const maxPageBytes = 2 * 1024 * 1024;
const kinds = ['article', 'background', 'draft', 'favorite', 'record', 'settings'];
type Stored = Omit<WorkspaceItem, 'value' | 'localConflict' | 'localConflictBase'> & { value: string | null; localConflict: number; localConflictBase: string | null };
type Previous = { updatedAt: number; value: string | null; revision: number };

function decode(row: Stored): WorkspaceItem {
  const { value, localConflict, localConflictBase, ...item } = row;
  if (value === null) return { ...item, deleted: true, ...(localConflict === 1 && { localConflict: true, ...(localConflictBase && { localConflictBase }) }) };
  const data: unknown = JSON.parse(value);
  if (item.kind === 'draft' && data && typeof data === 'object') {
    if ('claimId' in data) delete data.claimId;
    if ('recoveryRequestId' in data) delete data.recoveryRequestId;
  }
  return { ...item, value: data };
}

export async function createAsyncWorkspaceStore(db: AsyncDatabase) {
  if (db.dialect === 'sqlite') {
    await db.exec(`CREATE TABLE IF NOT EXISTS workspace_items (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, item_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL, value TEXT, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id,kind,item_id));
      CREATE TABLE IF NOT EXISTS workspace_revisions (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS workspace_generations (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, generation INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS workspace_deleted_drafts (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, draft_id TEXT NOT NULL, PRIMARY KEY(user_id,draft_id));
      CREATE TABLE IF NOT EXISTS workspace_deleted_records (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, record_id TEXT NOT NULL, PRIMARY KEY(user_id,record_id));
      CREATE TABLE IF NOT EXISTS workspace_legacy_record_aliases (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, alias_id TEXT NOT NULL, source_id TEXT NOT NULL, PRIMARY KEY(user_id,alias_id));
      CREATE TABLE IF NOT EXISTS workspace_local_conflict_bases (user_id TEXT NOT NULL, marker_id TEXT NOT NULL, base_id TEXT NOT NULL, PRIMARY KEY(user_id,marker_id),
        FOREIGN KEY(user_id,marker_id) REFERENCES workspace_legacy_record_aliases(user_id,alias_id) ON DELETE CASCADE);`);
    await db.transaction(async () => {
      const columns = new Set((await db.pragma('table_info(workspace_items)') as Array<{ name: string }>).map((column) => column.name));
      if (!columns.has('revision')) await db.exec('ALTER TABLE workspace_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
    }).immediate();
  }
  // Keep SQLite's existing reserved NUL marker. Empty IDs are rejected at the
  // API boundary and serve as the equivalent marker in PostgreSQL text.
  const localMarker = db.dialect === 'sqlite' ? '\0local-conflict' : '';
  const markerPredicate = db.dialect === 'sqlite' ? "a.source_id=char(0)||'local-conflict'" : "a.source_id=''";
  const marker = `CASE WHEN kind='record' AND value IS NULL AND EXISTS (SELECT 1 FROM workspace_legacy_record_aliases a WHERE a.user_id=workspace_items.user_id AND a.alias_id=workspace_items.item_id AND ${markerPredicate}) THEN 1 ELSE 0 END AS localConflict`;
  const select = `SELECT kind,item_id AS id,updated_at AS updatedAt,revision AS serverRevision,value,${marker},
    (SELECT b.base_id FROM workspace_local_conflict_bases b WHERE b.user_id=workspace_items.user_id AND b.marker_id=workspace_items.item_id) AS localConflictBase FROM workspace_items`;
  const getRows = db.prepare(`${select} WHERE user_id=? ORDER BY kind,item_id`);
  const getBackgrounds = db.prepare(`${select} WHERE user_id=? AND kind='background' ORDER BY kind,item_id`);
  const collation = db.dialect === 'postgres' ? ' COLLATE "C"' : '';
  const getPage = db.prepare(`${select} WHERE user_id=? AND (?=0 OR kind!='background') AND (kind${collation}>? OR (kind${collation}=? AND item_id${collation}>?)) ORDER BY kind${collation},item_id${collation} LIMIT 101`);
  const readItem = db.prepare('SELECT updated_at AS updatedAt,value,revision FROM workspace_items WHERE user_id=? AND kind=? AND item_id=?');
  const deletedDraft = db.prepare('SELECT 1 FROM workspace_deleted_drafts WHERE user_id=? AND draft_id=?');
  const deletedRecord = db.prepare('SELECT 1 FROM workspace_deleted_records WHERE user_id=? AND record_id=?');
  const ensureGeneration = db.prepare('INSERT OR IGNORE INTO workspace_generations(user_id,generation) VALUES (?,1)');
  const readGeneration = db.prepare('SELECT generation FROM workspace_generations WHERE user_id=?');
  const readRevision = db.prepare('SELECT revision FROM workspace_revisions WHERE user_id=?');
  const bumpRevision = db.prepare(`INSERT INTO workspace_revisions(user_id,revision) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET revision=workspace_revisions.revision+1`);
  const exemptAlias = "kind='record' AND value IS NULL AND EXISTS (SELECT 1 FROM workspace_legacy_record_aliases a WHERE a.user_id=workspace_items.user_id AND a.alias_id=workspace_items.item_id)";
  const byteLength = db.dialect === 'postgres' ? 'octet_length(value)' : 'length(CAST(value AS BLOB))';
  const limits = db.prepare(`SELECT COUNT(CASE WHEN NOT (${exemptAlias}) THEN 1 END) AS count, COALESCE(SUM(${byteLength}),0) AS bytes FROM workspace_items WHERE user_id=?`);
  const requiresConflictCapability = db.prepare('SELECT 1 FROM workspace_legacy_record_aliases WHERE user_id=? AND source_id=? LIMIT 1');
  const requiresConflictV2 = db.prepare('SELECT 1 FROM workspace_local_conflict_bases WHERE user_id=? LIMIT 1');
  const localConflictCount = db.prepare(`SELECT COUNT(*) AS count FROM workspace_legacy_record_aliases a JOIN workspace_items i ON i.user_id=a.user_id AND i.kind='record' AND i.item_id=a.alias_id WHERE a.user_id=? AND a.source_id=? AND i.value IS NULL`);
  const upsert = db.prepare(`INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id,kind,item_id) DO UPDATE SET updated_at=excluded.updated_at,value=excluded.value,revision=workspace_items.revision+1`);
  const generation = async (owner: string) => {
    await ensureGeneration.run(owner);
    return (await readGeneration.get(owner) as { generation: number }).generation;
  };
  const get = async (owner: string): Promise<WorkspaceItem[]> => (await getRows.all(owner) as Stored[]).map(decode);
  const requireCapability = async (owner: string, capability?: string) => {
    if (capability !== 'local-conflict-v2' && await requiresConflictV2.get(owner)) throw new WorkspaceClientUpdateRequiredError();
    if (!['local-conflict-v1', 'local-conflict-v2'].includes(capability ?? '') && await requiresConflictCapability.get(owner, localMarker)) throw new WorkspaceClientUpdateRequiredError();
  };
  const requireReadCapability = async (owner: string, capability?: string) => {
    // Older readers interpret the alternate marker as another record's hash.
    // Reject before returning it so they cannot remove an unrelated local copy.
    if (capability !== 'local-conflict-v2' && await requiresConflictV2.get(owner)) throw new WorkspaceClientUpdateRequiredError();
  };
  const merge = db.transaction(async (owner: string, requestedGeneration: number, items: WorkspaceItem[], capability?: string) => {
    if (await generation(owner) !== requestedGeneration) throw new WorkspaceGenerationError();
    await requireCapability(owner, capability);
    let changed = false;
    for (const { kind, id, updatedAt, deleted, value, baseRevision } of items) {
      const previous = await readItem.get(owner, kind, id) as Previous | undefined;
      let mergedValue = value;
      if (!deleted && previous?.value && value && typeof value === 'object' && !Array.isArray(value)) {
        const before = JSON.parse(previous.value) as Record<string, unknown>;
        const incoming = value as Record<string, unknown>;
        if (kind === 'settings') {
          mergedValue = { ...before, ...value };
          if (Array.isArray(before.presets) && 'presets' in value && Array.isArray(value.presets)) {
            const previousPresets = new Map(before.presets.filter((preset): preset is Record<string, unknown> => !!preset && typeof preset === 'object' && !Array.isArray(preset) && typeof preset.id === 'string').map((preset) => [preset.id, preset]));
            (mergedValue as Record<string, unknown>).presets = value.presets.map((preset: Record<string, unknown>) => {
              const earlier = previousPresets.get(preset.id);
              return earlier?.pace !== undefined && preset.pace === undefined ? { ...preset, pace: earlier.pace } : preset;
            });
          }
        } else if (kind === 'record' || kind === 'draft') {
          mergedValue = { ...value, ...(before.mistakesTruncated === true && !('mistakesTruncated' in value) && { mistakesTruncated: true }),
            ...(before.paceTarget !== undefined && !('paceTarget' in value) && { paceTarget: before.paceTarget }),
            ...(isProcessTrace(before.processTrace) && !('processTrace' in value) && { processTrace: kind === 'draft' && (before.typed !== incoming.typed || before.elapsedMs !== incoming.elapsedMs) ? { ...before.processTrace, missing: true } : before.processTrace }),
            ...(kind === 'draft' && typeof before.processErrorEvents === 'number' && !('processErrorEvents' in value) && { processErrorEvents: Math.max(before.processErrorEvents, isProcessTrace(incoming.processTrace) ? incoming.processTrace.samples.at(-1)!.errors : 0) }) };
        }
      }
      const serialized = deleted ? null : JSON.stringify(mergedValue);
      if (kind === 'draft' && !deleted && await deletedDraft.get(owner, id)) throw new WorkspaceConflictError();
      if (kind === 'record' && !deleted && await deletedRecord.get(owner, id)) throw new WorkspaceConflictError();
      if (baseRevision !== (previous?.revision ?? 0)) {
        if (previous && previous.updatedAt === updatedAt && previous.value === serialized) continue;
        throw new WorkspaceConflictError();
      }
      const incoming: WorkspaceItem = { kind, id, updatedAt, ...(deleted ? { deleted: true } : { value: mergedValue }) };
      const old: WorkspaceItem | undefined = previous && { kind, id, updatedAt: previous.updatedAt, ...(previous.value === null ? { deleted: true } : { value: JSON.parse(previous.value) }) };
      if (old && !newerWorkspaceItems([incoming], [old]).length) {
        if (previous!.updatedAt === updatedAt && previous!.value === serialized) continue;
        throw new WorkspaceConflictError();
      }
      await upsert.run(owner, kind, id, updatedAt, serialized); changed = true;
    }
    const { count, bytes } = await limits.get(owner) as { count: number; bytes: number };
    if (count > maxWorkspaceItems || bytes > maxWorkspaceBytes || (await localConflictCount.get(owner, localMarker) as { count: number }).count > 100) throw new WorkspaceLimitError();
    if (changed) await bumpRevision.run(owner);
  });
  const snapshot = db.transaction(async (owner: string, capability?: string, checkReadCapability = false) => {
    if (checkReadCapability) await requireReadCapability(owner, capability);
    return { generation: await generation(owner), items: await get(owner) };
  });
  const compact = db.transaction(async (owner: string, requestedGeneration: number, capability?: string) => {
    const current = await generation(owner);
    if (current !== requestedGeneration) throw new WorkspaceGenerationError();
    if (capability !== 'local-conflict-v2' && await requiresConflictV2.get(owner)) throw new WorkspaceClientUpdateRequiredError();
    await db.prepare("INSERT OR IGNORE INTO workspace_deleted_drafts(user_id,draft_id) SELECT user_id,item_id FROM workspace_items WHERE user_id=? AND kind='draft' AND value IS NULL").run(owner);
    const removed = (await db.prepare('DELETE FROM workspace_items WHERE user_id=? AND value IS NULL').run(owner)).changes;
    if (removed) { await db.prepare('UPDATE workspace_generations SET generation=generation+1 WHERE user_id=?').run(owner); await bumpRevision.run(owner); }
    return { removed, generation: current + Number(removed > 0) };
  });
  const deleteRecords = async (owner: string, ids: string[], time: number, legacyPairs: Array<{ id: string; alias: string; proof?: LegacyRecordProof }> = [], localConflicts: string[] = [], expectedRevisions: Array<{ id: string; revision: number }> = [], localConflictBases: Array<{ id: string; base: string }> = [], capability?: string) => {
    if (capability !== 'local-conflict-v2' && (localConflictBases.length || await requiresConflictV2.get(owner))) throw new WorkspaceClientUpdateRequiredError();
    const revisions = new Map(expectedRevisions.map(({ id, revision }) => [id, revision])); let changed = false;
    const bases = new Map(localConflictBases.map(({ id, base }) => [id, base]));
    for (const id of ids) {
      const previous = await readItem.get(owner, 'record', id) as Previous | undefined;
      if (previous?.value === null || (!previous && await deletedRecord.get(owner, id))) continue;
      if ((revisions.has(id) && revisions.get(id) !== (previous?.revision ?? 0)) || (/^guest-[0-9a-f]{16}$/u.test(id) && previous?.value && !revisions.has(id))) throw new WorkspaceConflictError();
    }
    for (const { id, alias, proof } of legacyPairs) {
      const source = await readItem.get(owner, 'record', id) as Previous | undefined;
      const existing = await readItem.get(owner, 'record', alias) as Previous | undefined;
      if (existing?.value) throw new WorkspaceConflictError();
      if (!source?.value) continue;
      const value: unknown = JSON.parse(source.value);
      if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { recordId?: unknown }).recordId !== undefined) continue;
      const candidate = { ...value, ownerId: owner } as PracticeRecord & { localSyncGeneration?: number };
      if (proof) { delete candidate.localOnly; delete candidate.status; delete candidate.localSyncGeneration; Object.assign(candidate, proof); }
      if (stableRecordId(candidate) !== alias) continue;
      changed = !!(await db.prepare('INSERT OR IGNORE INTO workspace_legacy_record_aliases(user_id,alias_id,source_id) VALUES (?,?,?)').run(owner, alias, id)).changes || changed;
    }
    let liveLocal = (await localConflictCount.get(owner, localMarker) as { count: number }).count;
    for (const id of localConflicts) {
      if (!ids.includes(id) || !/^legacy-conflict-[0-9a-f]{64}$/u.test(id)) continue;
      const existing = await readItem.get(owner, 'record', id) as Previous | undefined;
      if (existing?.value) throw new WorkspaceConflictError();
      const mapping = await db.prepare('SELECT source_id FROM workspace_legacy_record_aliases WHERE user_id=? AND alias_id=?').get(owner, id) as { source_id: string } | undefined;
      const storedBase = await db.prepare('SELECT base_id AS base FROM workspace_local_conflict_bases WHERE user_id=? AND marker_id=?').get(owner, id) as { base: string } | undefined;
      const base = bases.get(id);
      if (storedBase && storedBase.base !== base) throw new WorkspaceConflictError();
      if (existing && mapping?.source_id === localMarker && !base) continue;
      if (mapping && mapping.source_id !== localMarker) throw new WorkspaceConflictError();
      if (!existing || !mapping) {
        if (liveLocal >= 100) throw new WorkspaceLimitError();
        if (!mapping) changed = !!(await db.prepare('INSERT OR IGNORE INTO workspace_legacy_record_aliases(user_id,alias_id,source_id) VALUES (?,?,?)').run(owner, id, localMarker)).changes || changed;
        liveLocal++;
      }
      if (base && !storedBase) changed = !!(await db.prepare('INSERT INTO workspace_local_conflict_bases(user_id,marker_id,base_id) VALUES (?,?,?)').run(owner, id, base)).changes || changed;
    }
    for (const id of ids) {
      const previous = await readItem.get(owner, 'record', id) as Previous | undefined;
      await db.prepare('INSERT OR IGNORE INTO workspace_deleted_records(user_id,record_id) VALUES (?,?)').run(owner, id);
      if (previous?.value === null) continue;
      await upsert.run(owner, 'record', id, Math.max(time, (previous?.updatedAt ?? -1) + 1), null); changed = true;
    }
    const { count, bytes } = await limits.get(owner) as { count: number; bytes: number };
    if (count > maxWorkspaceItems || bytes > maxWorkspaceBytes) throw new WorkspaceLimitError();
    if (changed) await bumpRevision.run(owner);
  };
  const usage = db.transaction(async (owner: string) => {
    const counts = `COUNT(CASE WHEN NOT (${exemptAlias}) THEN 1 END) AS count, COALESCE(SUM(${byteLength}),0) AS bytes, COUNT(CASE WHEN value IS NULL AND NOT (${exemptAlias}) THEN 1 END) AS tombstones, COUNT(CASE WHEN ${exemptAlias} THEN 1 END) AS aliasTombstones`;
    const total = await db.prepare(`SELECT ${counts} FROM workspace_items WHERE user_id=?`).get(owner) as { count: number; bytes: number; tombstones: number; aliasTombstones: number };
    const types = await db.prepare(`SELECT kind,${counts} FROM workspace_items WHERE user_id=? GROUP BY kind ORDER BY kind`).all(owner);
    return { ...total, maxItems: maxWorkspaceItems, maxBytes: maxWorkspaceBytes, generation: await generation(owner), types };
  });
  const backgroundState = async (owner: string, known: string | undefined) => {
    const backgrounds = (await getBackgrounds.all(owner) as Stored[]).map(decode);
    const backgroundsVersion = createHash('sha256').update(owner).update(JSON.stringify(backgrounds)).digest('hex');
    return { backgroundsVersion, backgroundsUnchanged: known === backgroundsVersion };
  };
  const pagedSnapshot = db.transaction(async (owner: string, cursor: string | undefined, known: string | undefined, capability?: string) => {
    await requireReadCapability(owner, capability);
    const { backgroundsVersion, backgroundsUnchanged } = await backgroundState(owner, known);
    const revision = (await readRevision.get(owner) as { revision: number } | undefined)?.revision ?? 0;
    const currentGeneration = await generation(owner);
    let kind = ''; let id = '';
    if (cursor !== undefined) {
      try {
        if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
        const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(parsed) || parsed.length !== 3 || !Number.isSafeInteger(parsed[0]) || typeof parsed[1] !== 'string' || !kinds.includes(parsed[1]) || typeof parsed[2] !== 'string' || !parsed[2] || parsed[2].length > 200) throw new Error();
        if (parsed[0] !== revision) throw new WorkspaceChangedError();
        [, kind, id] = parsed;
      } catch (error) { if (error instanceof WorkspaceChangedError) throw error; throw new WorkspaceCursorError(); }
    }
    const candidates = (await getPage.all(owner, Number(backgroundsUnchanged), kind, kind, id) as Stored[]).map(decode);
    const items: WorkspaceItem[] = []; let bytes = 4096;
    for (const candidate of candidates) {
      const size = Buffer.byteLength(JSON.stringify(candidate)) + 1;
      if (bytes + size > maxPageBytes || items.length >= 100) { if (!items.length) throw new WorkspacePageSizeError(); break; }
      bytes += size; items.push(candidate);
    }
    const last = items.at(-1);
    const nextCursor = last && items.length < candidates.length ? Buffer.from(JSON.stringify([revision, last.kind, last.id])).toString('base64url') : null;
    return { items, nextCursor, generation: currentGeneration, backgroundsVersion, backgroundsUnchanged };
  });
  return { get, generation, snapshot: snapshot.immediate, usage: usage.immediate, merge: merge.immediate, compact: compact.immediate, deleteRecords, pagedSnapshot: pagedSnapshot.immediate, backgroundState };
}
