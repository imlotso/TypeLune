// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ArticleLibrary } from '../src/components/ArticleLibrary';
import { I18nProvider, localeStorageKey } from '../src/lib/i18n';
const props = { articles: [], favorites: [], onToggleFavorite: () => {}, onSelect: () => {}, onSave: vi.fn(), onDelete: () => {} };
const key = 'typelune.guest-article-notice.v1';
afterEach(() => { cleanup();vi.restoreAllMocks();localStorage.clear();props.onSave.mockClear(); });
it.each(['新建文章','导入自己的文章'])('gates guest entry %s without writing article or preference', name => {
 render(<ArticleLibrary {...props}/>);fireEvent.click(screen.getByRole('button',{name}));
 expect(screen.getByRole('dialog',{name:'游客文章仅保存在本机'})).toBeTruthy();
 expect(screen.getByText(/不会上传服务器/)).toBeTruthy();expect(screen.getByText(/清除浏览器数据/)).toBeTruthy();
 expect(props.onSave).not.toHaveBeenCalled();expect(localStorage.getItem(key)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'我已知晓，继续创建'}));
 expect(screen.getByRole('dialog',{name:'新建文章'})).toBeTruthy();expect(localStorage.getItem(key)).toBeNull();
});
it('remembers only explicit checked continuation, not cancellation',()=>{
 const view=render(<ArticleLibrary {...props}/>);fireEvent.click(screen.getByRole('button',{name:'新建文章'}));
 fireEvent.click(screen.getByLabelText('不再提醒'));fireEvent.keyDown(document,{key:'Escape'});expect(localStorage.getItem(key)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'新建文章'}));expect((screen.getByLabelText('不再提醒') as HTMLInputElement).checked).toBe(false);
 fireEvent.click(screen.getByLabelText('不再提醒'));fireEvent.click(screen.getByRole('button',{name:'我已知晓，继续创建'}));expect(localStorage.getItem(key)).toBe('acknowledged');
 view.unmount();render(<ArticleLibrary {...props}/>);fireEvent.click(screen.getByRole('button',{name:'新建文章'}));expect(screen.getByRole('dialog',{name:'新建文章'})).toBeTruthy();
});
it('does not persist acknowledgement when choosing login and leaves the editor closed',()=>{
 const login=vi.fn();render(<ArticleLibrary {...props} onLogin={login}/>);fireEvent.click(screen.getByRole('button',{name:'新建文章'}));fireEvent.click(screen.getByLabelText('不再提醒'));fireEvent.click(screen.getByRole('button',{name:'登录后同步'}));
 expect(login).toHaveBeenCalledOnce();expect(localStorage.getItem(key)).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();
});
it('allows continuing when storage is unavailable without claiming the choice was remembered',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('denied')});
 render(<ArticleLibrary {...props}/>);fireEvent.click(screen.getByRole('button',{name:'新建文章'}));fireEvent.click(screen.getByLabelText('不再提醒'));fireEvent.click(screen.getByRole('button',{name:'我已知晓，继续创建'}));
 expect(screen.getByRole('dialog',{name:'新建文章'})).toBeTruthy();expect(screen.getByRole('status').textContent).toContain('无法记住');
});
it('does not gate accounts and provides English guest copy',()=>{
 const view=render(<ArticleLibrary {...props} isSignedIn/>);fireEvent.click(screen.getByRole('button',{name:'新建文章'}));expect(screen.getByRole('dialog',{name:'新建文章'})).toBeTruthy();view.unmount();
 localStorage.setItem(localeStorageKey,'en');render(<I18nProvider><ArticleLibrary {...props}/></I18nProvider>);fireEvent.click(screen.getByRole('button',{name:'New article'}));expect(screen.getByRole('dialog',{name:'Guest articles stay on this device'})).toBeTruthy();expect(screen.getByRole('button',{name:'I understand, continue'})).toBeTruthy();
});
