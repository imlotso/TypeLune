// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider, localeStorageKey, useI18n } from '../src/lib/i18n';
import { ArticleLibrary } from '../src/components/ArticleLibrary';
import { RecordsView } from '../src/components/RecordsView';
import { DraftsView } from '../src/components/DraftsView';
import { MistakesView } from '../src/components/MistakesView';
import { RankingView } from '../src/components/RankingView';
function Toggle(){const {setLocale}=useI18n();return <button onClick={()=>setLocale('zh')}>Switch test locale</button>}
// Locale switches also update the URL; each case starts with a fresh visit.
beforeEach(()=>{window.history.replaceState(null, '', '/');localStorage.setItem(localeStorageKey,'en')});
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()});
it('keeps article content and editor input unchanged on UI language switch',()=>{
 const article={id:'a',title:'我的标题',text:'这是正文',language:'zh' as const,difficulty:'beginner' as const,custom:true as const};
 render(<I18nProvider><Toggle/><ArticleLibrary articles={[article]} favorites={[]} onToggleFavorite={()=>{}} onSelect={()=>{}} onSave={()=>{}} onDelete={()=>{}}/></I18nProvider>);
 expect(screen.getByRole('heading',{name:'我的标题'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Edit 我的标题'}));
 fireEvent.change(screen.getByLabelText('Text'),{target:{value:'未保存输入'}});
 fireEvent.click(screen.getByText('Switch test locale'));
 expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('未保存输入');
});
it('renders English history, draft and mistake empty states',()=>{
 const view=render(<I18nProvider><RecordsView records={[]} onReplay={()=>{}} onContinue={()=>{}} onDelete={async()=>{}}/></I18nProvider>);
 expect(screen.getByText('No records')).toBeTruthy();view.unmount();
 const drafts=render(<I18nProvider><DraftsView drafts={[]} onResume={()=>{}} onDelete={async()=>{}}/></I18nProvider>);
 expect(screen.getByText('No drafts')).toBeTruthy();drafts.unmount();
 render(<I18nProvider><MistakesView records={[]} states={{}} onStatus={()=>{}} onPractice={()=>{}}/></I18nProvider>);
 expect(screen.getByText('No mistakes')).toBeTruthy();
});
it('keeps leaderboard filters independent from UI language',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({entries:[],total:0}))));
 render(<I18nProvider><Toggle/><RankingView initial={{language:'zh',difficulty:'advanced',duration:120,mode:'timed',strict:false}} articles={[]} isAdmin={false} ownerId={null}/></I18nProvider>);
 expect(await screen.findByText('No scores yet')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Advanced'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByText('Switch test locale'));
 expect(screen.getByRole('button',{name:'挑战'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByRole('button',{name:'中文'}).getAttribute('aria-pressed')).toBe('true');
});
