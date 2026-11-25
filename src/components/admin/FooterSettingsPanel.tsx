import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import {
  defaultFooterSettings,
  defaultPageMarkdown,
  type FooterButtonId,
  type FooterExtraLink,
  type FooterSettings,
  type FooterSnapshot,
} from '../../lib/footer-settings';
import { renderMarkdownToHtml } from '../../lib/markdown';
import { applySiteFooter } from '../../hooks/useSiteFooter';
import { useAdminEdits } from '../AdminNavigationGuard';
import { SystemMessage } from '../SystemMessage';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';
import { useAdminText } from './i18n';

const footerPath = '/footer';

const pageNamesZh: Record<FooterButtonId, string> = {
  help: '使用帮助',
  feedback: '功能反馈（顶部说明）',
  privacy: '隐私政策',
  terms: '服务条款',
  about: '关于与联系',
};

const mdTools = [
  { label: 'H2', snippet: '\n## 小节标题\n' },
  { label: '粗体', snippet: '**重点文字**' },
  { label: '斜体', snippet: '*斜体文字*' },
  { label: '链接', snippet: '[链接文字](https://example.com)' },
  { label: '列表', snippet: '\n- 列表项一\n- 列表项二\n' },
  { label: '引用', snippet: '\n> 引用说明文字\n' },
  { label: '代码', snippet: '`行内代码`' },
  { label: '分割线', snippet: '\n---\n' },
] as const;

function FooterSettingsForm({ ownerId, initial, reload }: AdminProps & { initial: FooterSnapshot; reload: () => void }) {
  const { at } = useAdminText();
  const [saved, setSaved] = useState<FooterSnapshot>(initial);
  const [draft, setDraft] = useState<FooterSettings>(initial.settings);
  const [selectedPage, setSelectedPage] = useState<FooterButtonId>('about');
  const [editLang, setEditLang] = useState<'zh' | 'en'>('zh');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.settings);
  useAdminEdits(dirty, busy);

  const currentMarkdown = draft.pages[selectedPage][editLang];
  const previewSource = currentMarkdown.trim() || defaultPageMarkdown(selectedPage, editLang);
  const previewHtml = useMemo(() => (previewSource ? renderMarkdownToHtml(previewSource) : ''), [previewSource]);

  function updateDraft(updater: (prev: FooterSettings) => FooterSettings) {
    setDraft(updater);
    setSavedMessage('');
    setError('');
  }

  function moveButton(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= draft.buttons.length) return;
    updateDraft((prev) => {
      const next = [...prev.buttons];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, buttons: next };
    });
  }

  function insertMarkdown(snippet: string) {
    const textarea = editorRef.current;
    const value = draft.pages[selectedPage][editLang];
    if (!textarea) {
      updateDraft((prev) => ({
        ...prev,
        pages: { ...prev.pages, [selectedPage]: { ...prev.pages[selectedPage], [editLang]: value + snippet } },
      }));
      return;
    }
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const nextValue = value.slice(0, start) + snippet + value.slice(end);
    updateDraft((prev) => ({
      ...prev,
      pages: { ...prev.pages, [selectedPage]: { ...prev.pages[selectedPage], [editLang]: nextValue } },
    }));
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + snippet.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function addExtraLink() {
    if (draft.extraLinks.length >= 20) return;
    const newItem: FooterExtraLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      labelZh: '',
      labelEn: '',
      url: 'https://',
      enabled: true,
      openInNewTab: true,
    };
    updateDraft((prev) => ({ ...prev, extraLinks: [...prev.extraLinks, newItem] }));
  }

  function moveExtraLink(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= draft.extraLinks.length) return;
    updateDraft((prev) => {
      const next = [...prev.extraLinks];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, extraLinks: next };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty || conflict) return;
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      const updated = await adminWrite<FooterSnapshot>(ownerId, footerPath, {
        settings: draft,
        revision: saved.revision,
      });
      setSaved(updated);
      setDraft(updated.settings);
      applySiteFooter(updated.settings);
      setSavedMessage(at('页脚与页面设置已保存并生效'));
    } catch (problem) {
      setConflict(problem instanceof ApiError && problem.status === 409);
      setError(problem instanceof Error ? problem.message : at('保存页脚设置失败'));
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-footer-form" onSubmit={save}>
    <section className="admin-card-section">
      <div className="admin-section-head">
        <div>
          <h2>{at('页脚五个主按钮配置')}</h2>
          <p className="feature-muted">{at('可修改按钮中英文名称、显示开关、排序或改为外链；点击右侧按钮可编辑对应页面 Markdown 内容。')}</p>
        </div>
      </div>
      <div className="admin-footer-buttons-list">
        {draft.buttons.map((button, index) => (
          <div key={button.id} className={`admin-footer-button-row${selectedPage === button.id ? ' is-selected' : ''}`}>
            <div className="admin-footer-button-main">
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={button.enabled}
                  disabled={busy}
                  onChange={(e) => updateDraft((prev) => ({
                    ...prev,
                    buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, enabled: e.target.checked } : b),
                  }))}
                />
                <span>{at('显示')}</span>
              </label>
              <input
                type="text"
                aria-label={`${button.id} 中文名称`}
                placeholder={at('中文名称')}
                value={button.labelZh}
                maxLength={40}
                disabled={busy}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, labelZh: e.target.value } : b),
                }))}
              />
              <input
                type="text"
                aria-label={`${button.id} English label`}
                placeholder="English label"
                value={button.labelEn}
                maxLength={60}
                disabled={busy}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, labelEn: e.target.value } : b),
                }))}
              />
              <select
                aria-label={`${button.id} 跳转模式`}
                value={button.mode}
                disabled={busy}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, mode: e.target.value as 'page' | 'link' } : b),
                }))}
              >
                <option value="page">{at('站内页面')}</option>
                <option value="link">{at('自定义外链')}</option>
              </select>
              <div className="admin-row-actions">
                <button type="button" className="outline-button admin-icon-btn" disabled={busy || index === 0} onClick={() => moveButton(index, -1)} aria-label={at('上移')}>↑</button>
                <button type="button" className="outline-button admin-icon-btn" disabled={busy || index === draft.buttons.length - 1} onClick={() => moveButton(index, 1)} aria-label={at('下移')}>↓</button>
                <button
                  type="button"
                  className={selectedPage === button.id ? 'primary-button admin-compact-btn' : 'outline-button admin-compact-btn'}
                  disabled={busy}
                  onClick={() => setSelectedPage(button.id)}
                >
                  {at('编辑内容')}
                </button>
              </div>
            </div>
            {button.mode === 'link' && (
              <div className="admin-footer-button-extra">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={button.url}
                  maxLength={500}
                  disabled={busy}
                  onChange={(e) => updateDraft((prev) => ({
                    ...prev,
                    buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, url: e.target.value } : b),
                  }))}
                />
                <label className="admin-inline-toggle">
                  <input
                    type="checkbox"
                    checked={button.openInNewTab}
                    disabled={busy}
                    onChange={(e) => updateDraft((prev) => ({
                      ...prev,
                      buttons: prev.buttons.map((b, idx) => idx === index ? { ...b, openInNewTab: e.target.checked } : b),
                    }))}
                  />
                  <span>{at('新窗口打开')}</span>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>

    <section className="admin-card-section">
      <div className="admin-section-head">
        <div>
          <h2>{at('页面内容编辑')}：{at(pageNamesZh[selectedPage])}（Markdown）</h2>
          <p className="feature-muted">{at('支持标题、粗体、斜体、列表、链接、引用、代码和表格；留空时自动沿用系统内置内容。')}</p>
        </div>
        <div className="admin-section-controls">
          <div className="segmented admin-lang-switch" role="group" aria-label={at('内容语言')}>
            <button type="button" aria-pressed={editLang === 'zh'} onClick={() => setEditLang('zh')}>{at('中文')}</button>
            <button type="button" aria-pressed={editLang === 'en'} onClick={() => setEditLang('en')}>English</button>
          </div>
          <button
            type="button"
            className="outline-button admin-compact-btn"
            disabled={busy}
            onClick={() => updateDraft((prev) => ({
              ...prev,
              pages: {
                ...prev.pages,
                [selectedPage]: {
                  ...prev.pages[selectedPage],
                  [editLang]: defaultPageMarkdown(selectedPage, editLang),
                },
              },
            }))}
          >
            {at('填入默认模板')}
          </button>
          <button
            type="button"
            className="outline-button admin-compact-btn"
            disabled={busy || !currentMarkdown}
            onClick={() => updateDraft((prev) => ({
              ...prev,
              pages: {
                ...prev.pages,
                [selectedPage]: { ...prev.pages[selectedPage], [editLang]: '' },
              },
            }))}
          >
            {at('恢复内置默认')}
          </button>
        </div>
      </div>

      <div className="admin-md-toolbar" role="toolbar" aria-label={at('Markdown 快捷格式')}>
        {mdTools.map((tool) => (
          <button key={tool.label} type="button" className="outline-button admin-md-btn" disabled={busy} onClick={() => insertMarkdown(tool.snippet)}>
            {tool.label}
          </button>
        ))}
      </div>

      <div className="admin-md-split">
        <div className="admin-md-pane">
          <label className="admin-md-label" htmlFor="footer-md-editor">{at('Markdown 原文')}</label>
          <textarea
            id="footer-md-editor"
            ref={editorRef}
            className="admin-md-textarea"
            rows={14}
            maxLength={50000}
            disabled={busy}
            placeholder={at('留空将使用内置默认内容，点击上方「填入默认模板」可在默认文案基础上直接修改…')}
            value={currentMarkdown}
            onChange={(e) => updateDraft((prev) => ({
              ...prev,
              pages: {
                ...prev.pages,
                [selectedPage]: { ...prev.pages[selectedPage], [editLang]: e.target.value },
              },
            }))}
          />
        </div>
        <div className="admin-md-pane">
          <div className="admin-md-label">{at('实时渲染预览')}{!currentMarkdown.trim() && <span className="feature-muted">（{at('当前预览内置默认内容')}）</span>}</div>
          <div className="admin-md-preview markdown-body">
            {previewHtml
              ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              : <p className="feature-muted">{at('功能反馈页顶部默认不显示自定义公告，输入 Markdown 后将展示在反馈表单上方。')}</p>}
          </div>
        </div>
      </div>
    </section>

    <section className="admin-card-section">
      <div className="admin-section-head">
        <div>
          <h2>{at('底部归属与扩展链接')}</h2>
          <p className="feature-muted">{at('配置 Powered by SiteTalk 归属文案，并在旁边新增备案号、GitHub、更新日志等自定义页脚链接。')}</p>
        </div>
      </div>
      <div className="admin-attribution-row">
        <label className="admin-inline-toggle">
          <input
            type="checkbox"
            checked={draft.attribution.enabled}
            disabled={busy}
            onChange={(e) => updateDraft((prev) => ({ ...prev, attribution: { ...prev.attribution, enabled: e.target.checked } }))}
          />
          <span>{at('显示底部归属')}</span>
        </label>
        <input
          type="text"
          placeholder={at('前缀，如 Powered by')}
          value={draft.attribution.prefix}
          maxLength={40}
          disabled={busy}
          onChange={(e) => updateDraft((prev) => ({ ...prev, attribution: { ...prev.attribution, prefix: e.target.value } }))}
        />
        <input
          type="text"
          placeholder={at('品牌名，如 SiteTalk')}
          value={draft.attribution.label}
          maxLength={60}
          disabled={busy}
          onChange={(e) => updateDraft((prev) => ({ ...prev, attribution: { ...prev.attribution, label: e.target.value } }))}
        />
        <input
          type="url"
          placeholder="https://www.sitetalk.net"
          value={draft.attribution.url}
          maxLength={500}
          disabled={busy}
          onChange={(e) => updateDraft((prev) => ({ ...prev, attribution: { ...prev.attribution, url: e.target.value } }))}
        />
      </div>

      <div className="admin-extra-links">
        {draft.extraLinks.map((extra, index) => (
          <div key={extra.id} className="admin-extra-link-row">
            <label className="admin-inline-toggle">
              <input
                type="checkbox"
                checked={extra.enabled}
                disabled={busy}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  extraLinks: prev.extraLinks.map((item, idx) => idx === index ? { ...item, enabled: e.target.checked } : item),
                }))}
              />
              <span>{at('启用')}</span>
            </label>
            <input
              type="text"
              placeholder={at('中文名称（如：沪ICP备…）')}
              value={extra.labelZh}
              maxLength={60}
              disabled={busy}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                extraLinks: prev.extraLinks.map((item, idx) => idx === index ? { ...item, labelZh: e.target.value } : item),
              }))}
            />
            <input
              type="text"
              placeholder="English label (optional)"
              value={extra.labelEn}
              maxLength={80}
              disabled={busy}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                extraLinks: prev.extraLinks.map((item, idx) => idx === index ? { ...item, labelEn: e.target.value } : item),
              }))}
            />
            <input
              type="url"
              placeholder="https://..."
              value={extra.url}
              maxLength={500}
              disabled={busy}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                extraLinks: prev.extraLinks.map((item, idx) => idx === index ? { ...item, url: e.target.value } : item),
              }))}
            />
            <label className="admin-inline-toggle">
              <input
                type="checkbox"
                checked={extra.openInNewTab}
                disabled={busy}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  extraLinks: prev.extraLinks.map((item, idx) => idx === index ? { ...item, openInNewTab: e.target.checked } : item),
                }))}
              />
              <span>{at('新窗口')}</span>
            </label>
            <div className="admin-row-actions">
              <button type="button" className="outline-button admin-icon-btn" disabled={busy || index === 0} onClick={() => moveExtraLink(index, -1)} aria-label={at('上移')}>↑</button>
              <button type="button" className="outline-button admin-icon-btn" disabled={busy || index === draft.extraLinks.length - 1} onClick={() => moveExtraLink(index, 1)} aria-label={at('下移')}>↓</button>
              <button
                type="button"
                className="outline-button admin-compact-btn"
                disabled={busy}
                onClick={() => updateDraft((prev) => ({ ...prev, extraLinks: prev.extraLinks.filter((_, idx) => idx !== index) }))}
              >
                {at('删除')}
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="outline-button" disabled={busy || draft.extraLinks.length >= 20} onClick={addExtraLink}>
          + {at('新增页脚链接')}
        </button>
      </div>
    </section>

    {error && <p className="form-error" role="alert"><SystemMessage text={error} /></p>}
    {savedMessage && <p className="admin-saved-hint" role="status">{savedMessage}</p>}

    <div className="admin-sticky-actions">
      <button
        type="button"
        className="outline-button"
        disabled={busy}
        onClick={() => updateDraft(() => defaultFooterSettings())}
      >
        {at('恢复全部默认')}
      </button>
      <div className="admin-sticky-right">
        {conflict && <button type="button" className="outline-button" onClick={reload}>{at('重新加载')}</button>}
        <button type="submit" className="primary-button" disabled={busy || !dirty || conflict}>
          {busy ? at('正在保存…') : at('保存页脚与页面设置')}
        </button>
      </div>
    </div>
  </form>;
}

export function FooterSettingsPanel({ ownerId }: AdminProps) {
  const resource = useAdminResource<FooterSnapshot>(ownerId, footerPath);
  if (!resource.data) return <LoadState error={resource.error} retry={resource.retry} />;
  return <FooterSettingsForm key={resource.data.revision} ownerId={ownerId} initial={resource.data} reload={resource.retry} />;
}
