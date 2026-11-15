// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider, localeStorageKey } from '../src/lib/i18n';
import { StatsView } from '../src/components/StatsView';
import { ActivityCalendar } from '../src/components/ActivityCalendar';
import { FeedbackThread, type FeedbackDetail } from '../src/components/FeedbackView';
import type { PracticeRecord } from '../src/lib/models';
afterEach(()=>{cleanup();localStorage.clear();});
const record:PracticeRecord={recordId:'one',language:'zh',difficulty:'beginner',duration:300,mode:'timed',strict:false,speed:30,accuracy:90,finishedAt:Date.now(),elapsedMs:60000,article:{id:'a',title:'我的文章',text:'山海',language:'zh',difficulty:'beginner',custom:false}};
it('uses English statistics, units and accessible chart descriptions without translating article titles',()=>{
 localStorage.setItem(localeStorageKey,'en');render(<I18nProvider><StatsView records={[record]} coverage="complete" onOpenRecord={()=>{}} timeZone="UTC"/></I18nProvider>);
 const group=screen.getByRole('region',{name:/Matching sessions: 我的文章/});
 expect(within(group).getByRole('heading').textContent).toMatch(/^我的文章 · Version [a-f0-9]+ · Beginner · 5 min · Normal correction$/);
 expect(within(group).getAllByText('30 chars/min').length).toBeGreaterThan(0);
 expect(within(group).getByRole('button',{name:/View record: .*session 1, 30 chars\/min, accuracy 90%/})).toBeTruthy();
 expect(screen.getByRole('option',{name:'5 min'})).toBeTruthy();
});
it('uses English calendar day descriptions and durations',()=>{
 localStorage.setItem(localeStorageKey,'en');render(<I18nProvider><ActivityCalendar records={[record]} timeZone="UTC" goalMinutes={5} coverage="complete" now={record.finishedAt}/></I18nProvider>);
 const day=new Date(record.finishedAt).toISOString().slice(0,10);
 expect(screen.getByRole('button',{name:`${day}, 1 sessions`})).toBeTruthy();
 expect(screen.getByText(/1 sessions · 1 min 0 sec/)).toBeTruthy();
});
it('translates feedback system states but keeps submitted text unchanged',()=>{
 localStorage.setItem(localeStorageKey,'en');
 const feedback:FeedbackDetail={id:'f1',title:'用户标题',description:'用户正文',category:'issue',status:'processing',revision:1,createdAt:0,updatedAt:0,attachments:[],messages:[{id:'m1',authorKind:'status',text:'resolved',createdAt:1},{id:'m2',authorKind:'admin',text:'管理员原文',createdAt:2}]};
 render(<I18nProvider><FeedbackThread feedback={feedback}/></I18nProvider>);
 expect(screen.getByText('In progress')).toBeTruthy();expect(screen.getByText('Resolved')).toBeTruthy();expect(screen.getByText('Admin reply')).toBeTruthy();
 expect(screen.getByText('用户正文')).toBeTruthy();expect(screen.getByText('管理员原文')).toBeTruthy();
 expect(document.querySelector('time')?.textContent).toMatch(/Jan/);
});
