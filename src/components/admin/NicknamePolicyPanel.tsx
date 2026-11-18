import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { X } from "@phosphor-icons/react/X";
import { useI18n } from "../../lib/i18n";
import { ApiError } from "../../lib/api";
import {
  nicknameLanguages,
  nicknameModes,
  nicknameSource,
  nicknamePolicyError,
  nicknameTermKey,
  parseNicknameImport,
  type NicknameLanguage,
  type NicknamePolicy,
  type NicknamePolicySnapshot,
  type NicknameRule,
} from "../../lib/nickname-policy";
import { useAdminEdits } from "../AdminNavigationGuard";
import { Dialog } from "../Dialog";
import { SystemMessage } from "../SystemMessage";
import {
  adminWrite,
  LoadState,
  useAdminResource,
  type AdminProps,
} from "./common";
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Form({
  ownerId,
  initial,
  reload,
}: AdminProps & { initial: NicknamePolicySnapshot; reload: () => void }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState(initial),
    [settings, setSettings] = useState(initial.settings),
    [language, setLanguage] = useState<NicknameLanguage>(),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [conflict, setConflict] = useState(false);
  const [edit, setEdit] = useState<{
    language: NicknameLanguage;
    rule: NicknameRule;
    fresh: boolean;
  }>();
  const [importTarget, setImportTarget] = useState<NicknameLanguage | "all">();
  const dirty = JSON.stringify(settings) !== JSON.stringify(snapshot.settings);
  useAdminEdits(dirty, busy);
  const name = (language: NicknameLanguage) =>
    language === "zh"
      ? t("中文词包", "Chinese pack")
      : t("英文词包", "English pack");
  const modes = {
    contains: t("包含匹配", "Contains"),
    word: t("独立词匹配", "Whole word"),
    exact: t("完整昵称匹配", "Exact nickname"),
  };
  function change(next: NicknamePolicy) {
    setSettings(next);
    setSaved(false);
    setError("");
  }
  function remove(id: string) {
    if (!language) return;
    setPage(1);
    change({
      ...settings,
      packs: {
        ...settings.packs,
        [language]: settings.packs[language].filter((r) => r.id !== id),
      },
    });
  }
  async function save() {
    if (busy || !dirty || conflict) return;
    const invalid = nicknamePolicyError(settings);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await adminWrite<NicknamePolicySnapshot>(
        ownerId,
        "/nicknames",
        { settings, revision: snapshot.revision },
      );
      setSnapshot(next);
      setSettings(next.settings);
      setSaved(true);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : t("保存失败", "Could not save"),
      );
      if (problem instanceof ApiError && problem.status === 409)
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  function exportPack(
    target: NicknameLanguage | "all",
    format: "json" | "txt",
  ) {
    if (format === "json")
      download(
        `typelune-nicknames-${target}.json`,
        JSON.stringify(
          {
            version: 1,
            attribution: nicknameSource,
            ...(target === "all"
              ? { packs: settings.packs }
              : { language: target, rules: settings.packs[target] }),
          },
          null,
          2,
        ),
        "application/json;charset=utf-8",
      );
    else if (target !== "all")
      download(
        `typelune-nicknames-${target}.txt`,
        "\uFEFF# " +
          nicknameSource +
          "\n# term\tmode\tenabled\n" +
          settings.packs[target]
            .map((r) => `${r.term}\t${r.mode}\t${r.enabled ? 1 : 0}`)
            .join("\n"),
        "text/plain;charset=utf-8",
      );
  }
  const filtered = language
    ? settings.packs[language].filter((r) =>
        r.term.toLowerCase().includes(query.toLowerCase()),
      )
    : [];
  const shown = filtered.slice((page - 1) * 60, page * 60);
  return (
    <section className="nickname-policy-panel feature-form">
      <fieldset className="settings-group" disabled={busy || conflict}>
        <legend>{t("昵称过滤", "Nickname filtering")}</legend>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => change({ ...settings, enabled: e.target.checked })}
          />
          {t("启用昵称过滤", "Enable nickname filtering")}
        </label>
        <div className="nickname-language-packs">
          {nicknameLanguages.map((l) => (
            <article key={l}>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={settings.languages.includes(l)}
                  onChange={(e) =>
                    change({
                      ...settings,
                      languages: e.target.checked
                        ? [...settings.languages, l]
                        : settings.languages.filter((value) => value !== l),
                    })
                  }
                />
                {name(l)}
              </label>
              <span className="feature-muted">
                {settings.packs[l].length} {t("条", "terms")}
              </span>
              <button
                type="button"
                className="outline-button"
                onClick={() => {
                  setLanguage(l);
                  setQuery("");
                  setPage(1);
                }}
              >
                {t("查看词条", "View terms")}
              </button>
            </article>
          ))}
        </div>
        {settings.enabled && !settings.languages.length && (
          <p className="form-error" role="alert">
            {t("请选择至少一个词包", "Select at least one pack")}
          </p>
        )}
      </fieldset>
      <div className="feature-actions">
        <button
          type="button"
          className="outline-button"
          disabled={busy || conflict}
          onClick={() => setImportTarget(language ?? "all")}
        >
          {t("批量导入", "Import terms")}
        </button>
        <button
          type="button"
          className="outline-button"
          onClick={() => exportPack(language ?? "all", "json")}
        >
          {t("导出 JSON", "Export JSON")}
        </button>
        {language && (
          <button
            type="button"
            className="outline-button"
            onClick={() => exportPack(language, "txt")}
          >
            {t("导出 TXT", "Export TXT")}
          </button>
        )}
      </div>
      {language && (
        <section className="nickname-pack-editor">
          <div className="content-heading">
            <h2>{name(language)}</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => setLanguage(undefined)}
            >
              {t("返回词包", "Back to packs")}
            </button>
          </div>
          <div className="feature-toolbar">
            <label>
              {t("搜索词条", "Search terms")}
              <input
                type="search"
                value={query}
                maxLength={80}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <button
              type="button"
              className="outline-button"
              disabled={busy || conflict}
              onClick={() =>
                setEdit({
                  language,
                  fresh: true,
                  rule: {
                    id: crypto.randomUUID(),
                    term: "",
                    mode: language === "en" ? "word" : "contains",
                    enabled: true,
                  },
                })
              }
            >
              {t("添加词条", "Add term")}
            </button>
          </div>
          <div className="nickname-words" aria-label={name(language)}>
            {shown.map((rule) => (
              <div
                className={
                  "nickname-word" + (!rule.enabled ? " is-disabled" : "")
                }
                key={rule.id}
              >
                <button
                  type="button"
                  className="nickname-word-edit"
                  title={modes[rule.mode]}
                  disabled={busy || conflict}
                  onClick={() => setEdit({ language, rule, fresh: false })}
                >
                  {rule.term}
                </button>
                <button
                  type="button"
                  className="nickname-word-remove"
                  aria-label={t("删除词条", "Delete term") + " " + rule.term}
                  disabled={busy || conflict}
                  onClick={() => remove(rule.id)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {!filtered.length && (
            <p className="feature-muted">{t("没有词条", "No terms")}</p>
          )}
          <div className="feature-actions">
            <button
              type="button"
              className="outline-button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("上一页", "Previous")}
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(filtered.length / 60))}
            </span>
            <button
              type="button"
              className="outline-button"
              disabled={page >= Math.ceil(filtered.length / 60)}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("下一页", "Next")}
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          <SystemMessage text={error} />
        </p>
      )}
      {saved && (
        <p role="status">
          {t("昵称过滤设置已保存", "Nickname filtering settings saved")}
        </p>
      )}
      <div className="feature-actions">
        {dirty && (
          <span className="feature-muted">
            {t("有未保存的更改", "Unsaved changes")}
          </span>
        )}
        {conflict && (
          <button type="button" className="outline-button" onClick={reload}>
            {t("重新加载", "Reload")}
          </button>
        )}
        <button
          type="button"
          className="primary-button"
          disabled={
            busy || !dirty || conflict || !!nicknamePolicyError(settings)
          }
          onClick={() => void save()}
        >
          {busy
            ? t("保存中…", "Saving…")
            : t("保存昵称设置", "Save nickname settings")}
        </button>
      </div>
      <p className="feature-muted nickname-source">
        {t("初始词表：", "Initial wordlists: ")}
        <a
          href="https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words"
          target="_blank"
          rel="noopener noreferrer"
        >
          LDNOOBW / Wordnik
        </a>{" "}
        · CC BY 4.0
      </p>
      {edit && (
        <TermDialog
          value={edit.rule}
          modes={modes}
          onClose={() => setEdit(undefined)}
          onSave={(rule) => {
            const next = {
              ...settings,
              packs: {
                ...settings.packs,
                [edit.language]: edit.fresh
                  ? [...settings.packs[edit.language], rule]
                  : settings.packs[edit.language].map((r) =>
                      r.id === rule.id ? rule : r,
                    ),
              },
            };
            const invalid = nicknamePolicyError(next);
            if (invalid) throw Error(invalid);
            change(next);
            setEdit(undefined);
          }}
        />
      )}
      {importTarget && (
        <ImportDialog
          target={importTarget}
          onClose={() => setImportTarget(undefined)}
          onApply={(packs, replace) => {
            const next = { ...settings, packs: { ...settings.packs } };
            for (const l of nicknameLanguages) {
              if (!packs[l]) continue;
              const before = replace ? [] : next.packs[l],
                seen = new Set(before.map((r) => nicknameTermKey(r.term)));
              next.packs[l] = [
                ...before,
                ...packs[l]!.filter((r) => {
                  const k = nicknameTermKey(r.term);
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                }),
              ];
            }
            const invalid = nicknamePolicyError(next);
            if (invalid) throw Error(invalid);
            change(next);
            setLanguage(importTarget === "all" ? undefined : importTarget);
            setPage(1);
            setQuery("");
            setImportTarget(undefined);
          }}
        />
      )}
    </section>
  );
}
function TermDialog({
  value,
  modes,
  onClose,
  onSave,
}: {
  value: NicknameRule;
  modes: Record<NicknameRule["mode"], string>;
  onClose: () => void;
  onSave: (rule: NicknameRule) => void;
}) {
  const { t } = useI18n();
  const [rule, setRule] = useState(value),
    [error, setError] = useState("");
  return (
    <Dialog title={t("编辑词条", "Edit term")} onClose={onClose}>
      <form
        className="feature-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave({ ...rule, term: rule.term.trim() });
          } catch (p) {
            setError((p as Error).message);
          }
        }}
      >
        <label>
          {t("词条", "Term")}
          <input
            value={rule.term}
            maxLength={160}
            required
            onChange={(e) => setRule({ ...rule, term: e.target.value })}
          />
        </label>
        <label>
          {t("匹配方式", "Matching mode")}
          <select
            value={rule.mode}
            onChange={(e) =>
              setRule({ ...rule, mode: e.target.value as NicknameRule["mode"] })
            }
          >
            {nicknameModes.map((mode) => (
              <option key={mode} value={mode}>
                {modes[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
          />
          {t("启用词条", "Enable term")}
        </label>
        {error && (
          <p role="alert" className="form-error">
            <SystemMessage text={error} />
          </p>
        )}
        <div className="feature-actions">
          <button type="button" className="outline-button" onClick={onClose}>
            {t("取消", "Cancel")}
          </button>
          <button className="primary-button">
            {t("应用词条", "Apply term")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ImportDialog({
  target,
  onClose,
  onApply,
}: {
  target: NicknameLanguage | "all";
  onClose: () => void;
  onApply: (
    packs: Partial<Record<NicknameLanguage, NicknameRule[]>>,
    replace: boolean,
  ) => void;
}) {
  const { t } = useI18n();
  const [packs, setPacks] =
      useState<Partial<Record<NicknameLanguage, NicknameRule[]>>>(),
    [replace, setReplace] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function read(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const current = ++generation.current;
    setPacks(undefined);
    setError("");
    setLoading(true);
    try {
      if (file.size > 1024 * 1024) throw Error("导入文件不能超过 1 MB");
      const text = await file.text();
      if (current !== generation.current) return;
      const next: Partial<Record<NicknameLanguage, NicknameRule[]>> = {};
      if (target === "all") {
        const value = JSON.parse(text.replace(/^\uFEFF/, ""));
        if (!value.packs) throw Error("全部词包导入需要 JSON 备份");
        for (const l of nicknameLanguages)
          if (value.packs[l]) next[l] = parseNicknameImport(text, l);
        if (!Object.keys(next).length) throw Error("导入文件格式无效");
      } else next[target] = parseNicknameImport(text, target);
      setPacks(next);
    } catch (p) {
      if (current === generation.current) setError((p as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  return (
    <Dialog
      title={t("批量导入词条", "Import terms")}
      onClose={() => {
        generation.current++;
        onClose();
      }}
    >
      <div className="feature-form">
        <label>
          {target === "all"
            ? t("JSON 词包备份", "JSON wordlist backup")
            : "TXT / JSON"}
          <input
            type="file"
            accept=".txt,.json,text/plain,application/json"
            onChange={(e) => void read(e)}
          />
        </label>
        <label>
          {t("导入方式", "Import mode")}
          <select
            value={replace ? "replace" : "merge"}
            onChange={(e) => setReplace(e.target.value === "replace")}
          >
            <option value="merge">
              {t("合并，跳过重复词条", "Merge and skip duplicates")}
            </option>
            <option value="replace">
              {t("替换目标词包", "Replace target packs")}
            </option>
          </select>
        </label>
        {replace && (
          <p className="form-error">
            {t(
              "将替换目标词包中的现有词条。",
              "Existing terms in the target packs will be replaced.",
            )}
          </p>
        )}
        {packs && (
          <p role="status">
            {nicknameLanguages
              .filter((l) => packs[l])
              .map(
                (l) =>
                  (l === "zh" ? t("中文", "Chinese") : "English") +
                  " " +
                  packs[l]!.length +
                  " " +
                  t("条", "terms"),
              )
              .join(" · ")}
          </p>
        )}
        {loading && <p role="status">{t("读取中…", "Reading…")}</p>}
        {error && (
          <p role="alert" className="form-error">
            <SystemMessage text={error} />
          </p>
        )}
        <div className="feature-actions">
          <button type="button" className="outline-button" onClick={onClose}>
            {t("取消", "Cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!packs || loading}
            onClick={() => {
              try {
                onApply(packs!, replace);
              } catch (p) {
                setError((p as Error).message);
              }
            }}
          >
            {t("应用导入", "Apply import")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
export function NicknamePolicyPanel({ ownerId }: AdminProps) {
  const { data, error, retry } = useAdminResource<NicknamePolicySnapshot>(
    ownerId,
    "/nicknames",
  );
  return data ? (
    <Form
      key={ownerId + ":" + data.revision}
      ownerId={ownerId}
      initial={data}
      reload={retry}
    />
  ) : (
    <LoadState error={error} retry={retry} />
  );
}
