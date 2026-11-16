// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AssessmentPanel, WeakKeyPanel } from '../src/components/AssessmentPanel';
import { assessmentArticle } from '../src/lib/assessment';
import { I18nProvider } from '../src/lib/i18n';
afterEach(cleanup);
it('offers baseline and a truthful empty weak-key state in English',()=>{
 localStorage.setItem('typelune.ui-locale.v1','en'); const onSelect=vi.fn();
 render(<I18nProvider><AssessmentPanel records={[]} ownerId={null} onSelect={onSelect}/><WeakKeyPanel records={[]} ownerId={null} onSelect={onSelect}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Open baseline'}));
 expect(onSelect.mock.calls[0][0].custom).toBe(true);
 expect(screen.getByText('No recorded English key errors yet.')).toBeTruthy();
});
it('switching identity removes another account baseline',()=>{
 const onSelect=vi.fn(); const article=assessmentArticle('en');
 const records=[{article,typed:article.text,ownerId:'alice',recordId:'a',language:'en' as const,difficulty:'beginner' as const,duration:300,mode:'article' as const,strict:false,elapsedMs:60000,speed:0,accuracy:0,finishedAt:1}];
 const {rerender}=render(<I18nProvider><AssessmentPanel records={records} ownerId='alice' onSelect={onSelect}/></I18nProvider>);
 expect(screen.getByRole('button',{name:'Open retest'})).toBeTruthy();
 rerender(<I18nProvider><AssessmentPanel records={records} ownerId='bob' onSelect={onSelect}/></I18nProvider>);
 expect(screen.getByRole('button',{name:'Open baseline'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Open retest'})).toBeNull();
});
