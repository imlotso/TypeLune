// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ArticleLibrary } from '../src/components/ArticleLibrary';
import { I18nProvider, localeStorageKey } from '../src/lib/i18n';
const common = { articles: [], favorites: [], onToggleFavorite: () => {}, onSelect: () => {}, onSave: () => {}, onDelete: () => {} };
afterEach(() => { cleanup(); localStorage.clear(); });
it('offers login from the bottom card for a guest without opening the editor', () => {
 const login = vi.fn();
 render(<ArticleLibrary {...common} onLogin={login} isSignedIn={false} />);
 fireEvent.click(screen.getByRole('button', { name: /登录同步/ }));
 expect(login).toHaveBeenCalledOnce();
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('opens the real TXT editor directly for an account and can return to the library', () => {
 render(<ArticleLibrary {...common} isSignedIn />);
 fireEvent.click(screen.getByRole('button', { name: /导入自己的文章/ }));
 expect(screen.getByRole('dialog', { name: '新建文章' })).toBeTruthy();
 expect(screen.getByLabelText('导入 TXT')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: '取消' }));
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByRole('button', { name: /导入自己的文章/ })).toBeTruthy();
});
it('translates the guest card into English including empty search results', () => {
 localStorage.setItem(localeStorageKey, 'en');
 render(<I18nProvider><ArticleLibrary {...common} onLogin={() => {}} /></I18nProvider>);
 expect(screen.getByRole('button', { name: /Sign in to sync/ })).toBeTruthy();
 expect(screen.getByText('Not finding the right article?')).toBeTruthy();
});
it('lets guests import locally without requiring an account', () => {
 render(<ArticleLibrary {...common} onLogin={() => {}} />);
 fireEvent.click(screen.getByRole('button', { name: '导入自己的文章' }));
 expect(screen.getByRole('dialog', { name: '新建文章' })).toBeTruthy();
 expect(screen.getByLabelText('导入 TXT')).toBeTruthy();
});
