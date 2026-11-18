import { describe, expect, it } from "vitest";
import {
  compileNicknamePolicy,
  nicknamePolicyError,
  parseNicknameImport,
  type NicknamePolicy,
} from "../src/lib/nickname-policy";
import { defaultNicknamePolicy } from "../server/nickname-policy";
const policy = (
  languages: NicknamePolicy["languages"] = ["zh", "en"],
): NicknamePolicy => ({
  ...structuredClone(defaultNicknamePolicy),
  enabled: true,
  languages,
});
describe("nickname word packs and matching", () => {
  it("ships two attributed packs disabled until selected by the administrator", () => {
    expect(defaultNicknamePolicy.enabled).toBe(false);
    expect(defaultNicknamePolicy.languages).toEqual([]);
    expect(defaultNicknamePolicy.packs.zh).toHaveLength(318);
    expect(defaultNicknamePolicy.packs.en).toHaveLength(403);
    expect(nicknamePolicyError(defaultNicknamePolicy)).toBeUndefined();
    expect(
      compileNicknamePolicy(defaultNicknamePolicy)("fuck"),
    ).toBeUndefined();
  });
  it("normalizes case, fullwidth, accents, traditional Chinese and separated combinations while avoiding English substring false positives", () => {
    const match = compileNicknamePolicy(policy());
    for (const term of [
      "fuck",
      "ＦＵＣＫ", "fuck123", "123FUCK",
      "f.u.c.k",
      "F Ú C K",
      "操你媽",
      "操-你-妈",
    ])
      expect(match(term), term).toBeTruthy();
    for (const term of [
      "class",
      "Scunthorpe",
      "assistance",
      "小云朵",
      "butterfly",
    ])
      expect(match(term), term).toBeUndefined();
    expect(compileNicknamePolicy(policy(["zh"]))("fuck")).toBeUndefined();
    expect(compileNicknamePolicy(policy(["en"]))("操你妈")).toBeUndefined();
  });
  it("honors disabled terms, deleted terms and contains versus exact single character modes", () => {
    const p: NicknamePolicy = {
      enabled: true,
      languages: ["zh"],
      packs: {
        zh: [
          { id: "single", term: "坏", mode: "exact", enabled: true },
          { id: "disabled", term: "其他", mode: "contains", enabled: false },
        ],
        en: [],
      },
    };
    expect(compileNicknamePolicy(p)("坏")).toBeTruthy();
    expect(compileNicknamePolicy(p)("坏天气")).toBeUndefined();
    expect(compileNicknamePolicy(p)("其他")).toBeUndefined();
    p.packs.zh[0].mode = "contains";
    expect(compileNicknamePolicy(p)("坏天气")).toBeTruthy();
    p.packs.zh = [];
    expect(compileNicknamePolicy(p)("坏")).toBeUndefined();
  });
  it("imports deduplicated UTF8 TXT and complete JSON backups without changing activation", () => {
    const rules = parseNicknameImport(
      "\uFEFF# comment\n测试\n测试\n单\texact\t0",
      "zh",
    );
    expect(
      rules.map(({ term, mode, enabled }) => ({ term, mode, enabled })),
    ).toEqual([
      { term: "测试", mode: "contains", enabled: true },
      { term: "单", mode: "exact", enabled: false },
    ]);
    const restored = parseNicknameImport(
      JSON.stringify({ packs: { zh: rules, en: [] } }),
      "zh",
    );
    expect(restored.map((r) => r.term)).toEqual(["测试", "单"]);
    expect(restored[1].enabled).toBe(false);
    expect(
      parseNicknameImport(JSON.stringify(["test", "TEST", "two words"]), "en"),
    ).toHaveLength(2);
  });
  it("rejects malformed and overlarge policies and imports", () => {
    for (const data of [
      null,
      {},
      { enabled: true, languages: [], packs: { zh: [], en: [] } },
      { ...policy(), languages: ["fr"] },
      {
        ...policy(),
        packs: {
          zh: [{ id: "x", term: "\u0000", mode: "contains", enabled: true }],
          en: [],
        },
      },
    ])
      expect(nicknamePolicyError(data)).toBeTruthy();
    for (const text of [
      "{bad",
      "[null]",
      '[{"term":"test","mode":"regex"}]',
      "a".repeat(1024 * 1024 + 1),
    ])
      expect(() => parseNicknameImport(text, "en")).toThrow();
  });
});
