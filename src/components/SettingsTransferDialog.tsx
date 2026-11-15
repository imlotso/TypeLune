import { useI18n } from '../lib/i18n';
import { useState, type ChangeEvent } from 'react';
import type { Difficulty, Language } from '../data/articles';
import type { ReaderSettings } from '../lib/models';
import { exportPracticeSettings, parsePracticeSettings, type PracticeSettingsFile } from '../lib/practice-settings';
import { Dialog } from './Dialog';


export function SettingsTransferDialog({ settings, language, difficulty, onImport, onClose }: { settings: ReaderSettings; language: Language; difficulty: Difficulty;
  onImport: (file: PracticeSettingsFile) => Promise<void>; onClose: () => void }) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };
const paceName = (pace: PracticeSettingsFile['settings']['pace'], language: Language) => !pace.enabled ? t("关", "Off") : pace.source === 'custom' ? `${pace.customSpeed} ${language === 'zh' ? t("字/分", "chars/min") : 'WPM'}` : pace.source === 'last' ? t("上次成绩", "Last result") : t("个人最佳", "Personal best");

  const [file, setFile] = useState<PracticeSettingsFile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function exportSettings() {
    setError(''); setNotice('');
    try {
      const content = exportPracticeSettings(settings, language, difficulty);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'typing-practice-settings.json'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("设置已导出", "Settings exported"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("导出失败", "Export failed")); }
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setFile(undefined); setError(''); setNotice('');
    if (!selected) return;
    if (selected.size > 256 * 1024) { setError(t("设置文件不能超过 256 KB", "Settings file must not exceed 256 KB")); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      try { setFile(parsePracticeSettings(new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer))); }
      catch (problem) { setError(problem instanceof TypeError ? t("设置文件须为 UTF-8", "Settings file must use UTF-8") : problem instanceof Error ? problem.message : t("设置文件无法读取", "Could not read settings file")); }
      finally { setBusy(false); }
    };
    reader.onerror = () => { setError(t("设置文件无法读取", "Could not read settings file")); setBusy(false); };
    try { reader.readAsArrayBuffer(selected); }
    catch { setError(t("设置文件无法读取", "Could not read settings file")); setBusy(false); }
  }
  async function apply() {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { await onImport(file); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("导入失败", "Import failed")); }
    finally { setBusy(false); }
  }
  return <Dialog title={t("练习设置导入／导出", "Import / export practice settings")} onClose={onClose} dismissible={!busy}>
    <div className="feature-form">
      <button type="button" className="outline-button" disabled={busy} onClick={exportSettings}>{t("导出设置 JSON", "Export settings JSON")}</button>
      <label className="feature-file"><span>{t("选择设置 JSON", "Choose settings JSON")}</span><input type="file" accept=".json,application/json" disabled={busy} onClick={(event) => { event.currentTarget.value = ''; setFile(undefined); setError(''); setNotice(''); }} onChange={selectFile} /></label>
      {file && <div className="feature-form">
        <p>{file.settings.language === 'zh' ? t("中文", "Chinese") : 'English'} · {difficultyNames[file.settings.difficulty]} · {file.settings.mode === 'article' ? t(`整篇 · 限时默认 ${file.settings.minutes} 分钟`, `Full article · default time ${file.settings.minutes} min`) : t(`限时 ${file.settings.minutes} 分钟`, `Timed ${file.settings.minutes} min`)}{file.settings.strict ? t(" · 严格纠错", " · Strict correction") : ''}</p>
        <p>{t("自动暂停：", "Auto-pause: ")}{file.settings.autoPause ? t("开", "On") : t("关", "Off")} {t("· 字号", "· Font size ")}{file.settings.fontSize} {t("· 行距", "· Line spacing ")}{file.settings.lineHeight} {t("· 可见", "· Visible ")}{file.settings.visibleLines} {t("行", " lines")}</p>
        <p>{t("实时指标：计时", "Live metrics: timer ")}{file.settings.showTimer ? t("开", "On") : t("关", "Off")}{t("、速度", ", speed ")}{file.settings.showSpeed ? t("开", "On") : t("关", "Off")}{t("、准确率", ", accuracy ")}{file.settings.showAccuracy ? t("开", "On") : t("关", "Off")}</p>
        <p>{t("配速：", "Pace: ")}{paceName(file.settings.pace, file.settings.language)}</p>
        <p>{t("快捷键：", "Shortcuts: ")}{file.settings.shortcutsEnabled ? t("开", "On") : t("关", "Off")}</p>
        <p>{t("预设：", "Presets: ")}{file.presets.length} {t("项", " items")}</p>
        {!!file.presets.length && <ul>{file.presets.map((preset) => <li key={preset.id}>{preset.name} · {preset.language === 'zh' ? t("中文", "Chinese") : 'English'} · {difficultyNames[preset.difficulty]} · {preset.mode === 'article' ? t(`整篇 · 限时默认 ${preset.minutes} 分钟`, `Full article · default time ${preset.minutes} min`) : t(`${preset.minutes} 分钟`, `${preset.minutes} min`)} · {preset.strict ? t("严格纠错", "Strict correction") : t("非严格", "Standard")} {t("· 自动暂停", "· Auto-pause ")}{preset.autoPause ? t("开", "On") : t("关", "Off")}{preset.pace && t(` · 配速 ${paceName(preset.pace, preset.language)}`, ` · Pace ${paceName(preset.pace, preset.language)}`)}{preset.reading && t(` · 字号 ${preset.reading.fontSize} · 行距 ${preset.reading.lineHeight} · ${preset.reading.visibleLines} 行 · 计时${preset.reading.showTimer ? t("开", "On") : t("关", "Off")}、速度${preset.reading.showSpeed ? t("开", "On") : t("关", "Off")}、准确率${preset.reading.showAccuracy ? t("开", "On") : t("关", "Off")}`, ` · Font ${preset.reading.fontSize} · Line spacing ${preset.reading.lineHeight} · ${preset.reading.visibleLines} lines · Timer ${preset.reading.showTimer ? "On" : "Off"}, speed ${preset.reading.showSpeed ? "On" : "Off"}, accuracy ${preset.reading.showAccuracy ? "On" : "Off"}`)}</li>)}</ul>}
        <p className="form-error">{t("导入将替换当前练习设置和预设；未完成练习会保存为草稿。", "Import replaces current practice settings and presets. Unfinished practice is saved as a draft.")}</p>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void apply()}>{t("确认导入", "Confirm import")}</button>
      </div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-notice">{notice}</p>}
    </div>
  </Dialog>;
}
