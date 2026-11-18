export const nicknameLanguages = ["zh", "en"] as const;
export type NicknameLanguage = (typeof nicknameLanguages)[number];
export const nicknameModes = ["contains", "word", "exact"] as const;
export type NicknameRule = {
  id: string;
  term: string;
  mode: (typeof nicknameModes)[number];
  enabled: boolean;
};
export type NicknamePolicy = {
  enabled: boolean;
  languages: NicknameLanguage[];
  packs: Record<NicknameLanguage, NicknameRule[]>;
};
export type NicknamePolicySnapshot = {
  settings: NicknamePolicy;
  revision: number;
};
export const nicknameSource =
  "LDNOOBW / Wordnik — https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words — CC BY 4.0";
const variants: Record<string, string> = {
  媽: "妈",
  幹: "干",
  雞: "鸡",
  陰: "阴",
  賤: "贱",
  貨: "货",
  腦: "脑",
  殘: "残",
  廢: "废",
  滾: "滚",
  雜: "杂",
  種: "种",
  兒: "儿",
  龜: "龟",
  機: "机",
  槍: "枪",
  體: "体",
  糞: "粪",
  裏: "里",
  騷: "骚",
  姦: "奸",
  獸: "兽",
  傻: "傻",
};
export function normalizeNickname(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\p{Cf}/gu, "")
    .replace(
      /[媽幹雞陰賤貨腦殘廢滾雜種兒龜機槍體糞裏騷姦獸]/gu,
      (char) => variants[char],
    );
}
export function compactNickname(value: string) {
  return normalizeNickname(value).replace(/[\p{P}\p{S}\p{Z}\s]/gu, (char) =>
    /\p{Extended_Pictographic}/u.test(char) ? char : "",
  );
}
export const nicknameTermKey = (term: string) =>
  term.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
export function nicknamePolicyError(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "昵称过滤设置无效";
  const p = value as NicknamePolicy;
  if (
    Object.keys(p).some(
      (k) => !["enabled", "languages", "packs"].includes(k),
    ) ||
    typeof p.enabled !== "boolean" ||
    !Array.isArray(p.languages) ||
    p.languages.some((l) => !nicknameLanguages.includes(l)) ||
    new Set(p.languages).size !== p.languages.length ||
    (p.enabled && !p.languages.length) ||
    !p.packs ||
    typeof p.packs !== "object" ||
    Object.keys(p.packs).some(
      (l) => !nicknameLanguages.includes(l as NicknameLanguage),
    )
  )
    return "昵称过滤设置无效";
  let count = 0;
  const ids = new Set<string>();
  for (const language of nicknameLanguages) {
    const rules = p.packs[language];
    if (!Array.isArray(rules)) return "昵称过滤设置无效";
    count += rules.length;
    const terms = new Set<string>();
    for (const r of rules) {
      if (
        !r ||
        typeof r !== "object" ||
        Object.keys(r).some(
          (k) => !["id", "term", "mode", "enabled"].includes(k),
        ) ||
        typeof r.id !== "string" ||
        !/^[-a-z0-9_]{1,64}$/.test(r.id) ||
        ids.has(r.id) ||
        typeof r.term !== "string" ||
        !r.term.trim() ||
        r.term !== r.term.trim() ||
        Array.from(r.term).length > 80 ||
        /[\p{Cc}\p{Cf}]/u.test(r.term) ||
        !compactNickname(r.term) ||
        !nicknameModes.includes(r.mode) ||
        typeof r.enabled !== "boolean"
      )
        return "词条格式无效";
      ids.add(r.id);
      const key = nicknameTermKey(r.term);
      if (terms.has(key)) return "词包中有重复词条";
      terms.add(key);
    }
  }
  return count > 5000 ? "词条总数不能超过 5000" : undefined;
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function compileNicknamePolicy(policy: NicknamePolicy) {
  const rules = policy.enabled
    ? policy.languages.flatMap((language) =>
        policy.packs[language]
          .filter((r) => r.enabled)
          .map((rule) => {
            const term = compactNickname(rule.term);
            return {
              language,
              rule,
              term,
              expression:
                rule.mode === "word"
                  ? new RegExp(
                      "(?<![a-z])" +
                        Array.from(term)
                          .map(escape)
                          .join("[\\p{P}\\p{S}\\p{Z}\\s]*") +
                        "(?![a-z])",
                      "u",
                    )
                  : undefined,
            };
          }),
      )
    : [];
  return (name: string) => {
    const base = normalizeNickname(name),
      compact = compactNickname(name);
    return rules.find((r) =>
      r.rule.mode === "contains"
        ? compact.includes(r.term)
        : r.rule.mode === "exact"
          ? compact === r.term
          : r.expression!.test(base),
    );
  };
}
export function parseNicknameImport(
  text: string,
  language: NicknameLanguage,
): NicknameRule[] {
  if (new TextEncoder().encode(text).length > 1024 * 1024)
    throw Error("导入文件不能超过 1 MB");
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  let entries: unknown[];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const value = JSON.parse(trimmed);
    if (!value || typeof value !== "object") throw Error("导入文件格式无效");
    entries = Array.isArray(value)
      ? value
      : Array.isArray(value.rules)
        ? value.rules
        : value.packs?.[language];
    if (!Array.isArray(entries)) throw Error("导入文件格式无效");
  } else
    entries = trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
      .map((line) => {
        const [term, mode, enabled] = line.split("\t");
        return {
          term: term.trim(),
          ...(mode && { mode }),
          enabled: enabled !== "0" && enabled !== "false",
        };
      });
  if (entries.length > 5000) throw Error("词条总数不能超过 5000");
  const seen = new Set<string>();
  const rules: NicknameRule[] = [];
  for (const item of entries) {
    const value =
      typeof item === "string"
        ? { term: item }
        : (item as Partial<NicknameRule>);
    if (!value || typeof value.term !== "string")
      throw Error("导入文件格式无效");
    const term = value.term.trim(),
      key = nicknameTermKey(term);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push({
      id: crypto.randomUUID(),
      term,
      mode:
        value.mode ??
        (Array.from(term).length === 1
          ? "exact"
          : language === "en"
            ? "word"
            : "contains"),
      enabled: value.enabled ?? true,
    });
  }
  const error = nicknamePolicyError({
    enabled: false,
    languages: [],
    packs: {
      zh: language === "zh" ? rules : [],
      en: language === "en" ? rules : [],
    },
  });
  if (error) throw Error(error);
  return rules;
}
