import { useId, useRef, useState, type ReactNode } from "react";
import { BookOpen } from "@phosphor-icons/react/BookOpen";
import { useI18n } from "../lib/i18n";
import type { PracticeResult } from "../hooks/usePractice";
import type { ArticleSnapshot } from "../lib/models";
import { EnglishSpeed, EnglishSpeedExplanation } from "./EnglishSpeed";
import { ProcessChart } from "./ProcessChart";
import { isCustomPracticeArticle } from "../lib/practice-kind";
const time = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
type Props = {
  result: PracticeResult;
  article: ArticleSnapshot;
  typed: number;
  offset: number;
  status: ReactNode;
  comparison: ReactNode;
  course: ReactNode;
  mistakes: ReactNode;
  leaderboard: ReactNode;
  actions: ReactNode;
};
export function ResultLayout({
  result,
  article,
  typed,
  offset,
  status,
  comparison,
  course,
  mistakes,
  leaderboard,
  actions,
}: Props) {
  const { t } = useI18n(),
    id = useId();
  const [tab, setTab] = useState(0);
  const [speedExplanation, setSpeedExplanation] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = [
    t("概览", "Overview"),
    t("过程", "Timeline"),
    t("错字", "Mistakes"),
  ];
  const metrics = [
    [
      t("已打 / 文章字数", "Typed / article chars"),
      `${typed.toLocaleString()} / ${result.articleTotal.toLocaleString()}`,
    ],
    [t("错误字数", "Errors"), result.errors],
    [t("退格次数", "Backspaces"), result.backspaces],
    [t("有效用时", "Active time"), time(result.elapsedMs)],
  ];
  return (
    <>
      <div className="result-scroll">
        <section className="result-article">
          <BookOpen size={26} aria-hidden="true" />
          <div>
            <h3>{article.title}</h3>
            <p>
              {[
                article.author,
                result.language === "zh" ? t("中文", "Chinese") : "English",
                isCustomPracticeArticle(article, result.custom || article.custom)
                  ? t("自定义", "Custom")
                  : article.difficulty === "beginner"
                    ? t("入门", "Beginner")
                    : article.difficulty === "intermediate"
                      ? t("进阶", "Intermediate")
                      : t("挑战", "Advanced"),
                result.record?.mode === "article"
                  ? t("全文练习", "Full article")
                  : result.record?.duration
                    ? `${t("限时", "Timed")} ${result.record.duration / 60} ${t("分钟", "min")}`
                    : t("限时练习", "Timed practice"),
                result.record?.strict
                  ? t("严格纠错", "Strict correction")
                  : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </section>
        <div className="result-columns">
          <div className="result-main">
            <div
              className="result-tabs"
              role="tablist"
              aria-label={t("成绩详情", "Result details")}
              onKeyDown={(event) => {
                let next = tab;
                if (event.key === "ArrowRight") next = (tab + 1) % 3;
                else if (event.key === "ArrowLeft") next = (tab + 2) % 3;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = 2;
                else return;
                event.preventDefault();
                setTab(next);
                tabs.current[next]?.focus();
              }}
            >
              {labels.map((label, index) => (
                <button
                  key={index}
                  ref={(element) => {
                    tabs.current[index] = element;
                  }}
                  id={`${id}-tab-${index}`}
                  role="tab"
                  aria-selected={tab === index}
                  aria-controls={`${id}-panel-${index}`}
                  tabIndex={tab === index ? 0 : -1}
                  onClick={() => setTab(index)}
                >
                  {label}
                </button>
              ))}
            </div>
            <section
              id={`${id}-panel-0`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-0`}
              hidden={tab !== 0}
              tabIndex={0}
              className="result-overview"
            >
              <div className="result-heroes">
                <div className="result-hero result-speed">
                  <span>{t("打字速度", "Typing speed")}</span>
                  {result.language === "en" ? (
                    <EnglishSpeed
                      score={result.score}
                      display="result"
                      explanationControl={{
                        expanded: speedExplanation,
                        id: id + "-speed",
                        onToggle: () => setSpeedExplanation((value) => !value),
                      }}
                    />
                  ) : (
                    <strong>
                      {result.score.cpm}
                      <small>{t("字 / 分钟", "Chars / min")}</small>
                    </strong>
                  )}
                </div>
                <div className="result-hero result-accuracy">
                  <span>{t("准确率", "Accuracy")}</span>
                  <strong>
                    {result.score.accuracy}
                    <small>%</small>
                  </strong>
                  <div className="result-accuracy-track" aria-hidden="true">
                    <span
                      style={{
                        width:
                          Math.max(0, Math.min(100, result.score.accuracy)) +
                          "%",
                      }}
                    />
                  </div>
                </div>
              </div>
              {result.language === "en" && (
                <EnglishSpeedExplanation
                  id={id + "-speed"}
                  hidden={!speedExplanation}
                />
              )}
              <dl className="result-statistics">
                {metrics.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {offset > 0 && (
                <p className="feature-muted">
                  {t("本轮输入", "This round")} {result.score.total}{" "}
                  {t("字", "chars")}
                </p>
              )}
              {comparison}
              <div className="result-mini-chart">
                <ProcessChart
                  trace={result.record?.processTrace}
                  language={result.language}
                />
              </div>
              {course}
            </section>
            <section
              id={`${id}-panel-1`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-1`}
              hidden={tab !== 1}
              tabIndex={0}
            >
              <ProcessChart
                trace={result.record?.processTrace}
                language={result.language}
              />
            </section>
            <section
              id={`${id}-panel-2`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-2`}
              hidden={tab !== 2}
              tabIndex={0}
              className="result-mistakes"
            >
              {mistakes}
            </section>
          </div>
          <aside
            className="result-sidebar"
            aria-label={t("成绩与上榜状态", "Result and leaderboard status")}
          >
            <h3>{t("排行榜", "Leaderboard")}</h3>
            <div className="result-score-status">{status}</div>
            {leaderboard}
          </aside>
        </div>
      </div>
      <div className="result-footer">{actions}</div>
    </>
  );
}
