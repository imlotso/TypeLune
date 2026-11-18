import { useId, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  guestNicknamePrefix,
  maxGuestNicknameLength,
  validGuestNickname,
} from "../lib/leaderboard";
import { splitCharacters } from "../lib/scoring";

export function GuestNicknameField({
  value,
  onChange,
  blocked = false,
}: {
  value: string;
  onChange: (value: string) => void;
  blocked?: boolean;
}) {
  const { t } = useI18n(),
    id = useId();
  const [composing, setComposing] = useState(false);
  const suffix = value.startsWith(guestNicknamePrefix)
    ? value.slice(guestNicknamePrefix.length)
    : value;
  const limit = maxGuestNicknameLength - guestNicknamePrefix.length,
    count = splitCharacters(suffix).length;
  const invalid = !validGuestNickname(guestNicknamePrefix + suffix) || blocked;
  return (
    <div className="guest-nickname">
      <label htmlFor={id}>{t("上榜昵称", "Leaderboard nickname")}</label>
      <div className={"guest-nickname-input" + (invalid ? " is-invalid" : "")}>
        <span
          className="guest-nickname-prefix"
          aria-label={t("固定前缀 visitor", "Fixed prefix visitor")}
        >
          {guestNicknamePrefix}
        </span>
        <input
          id={id}
          value={suffix}
          maxLength={160}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={id + "-preview"}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onChange={(e) => onChange(guestNicknamePrefix + e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.startsWith(guestNicknamePrefix) && !suffix && !composing) {
              e.preventDefault();
              onChange(
                guestNicknamePrefix + text.slice(guestNicknamePrefix.length),
              );
            }
          }}
        />
      </div>
      <div id={id + "-preview"} className="guest-nickname-preview">
        <span>
          {t("显示为", "Display name")}{" "}
          <strong>{guestNicknamePrefix + suffix}</strong>
        </span>
        <span>
          {count} / {limit}
        </span>
      </div>
      {count > limit && (
        <p className="form-error">
          {t(
            "昵称后缀最多 9 个字符",
            "Use at most 9 characters after the prefix",
          )}
        </p>
      )}
    </div>
  );
}
