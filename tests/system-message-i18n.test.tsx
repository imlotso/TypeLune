// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';import {afterEach,it,expect} from 'vitest';import {I18nProvider,localeStorageKey} from '../src/lib/i18n';import {SystemMessage,translateSystemMessage} from '../src/components/SystemMessage';
afterEach(()=>{cleanup();localStorage.clear()});
it('localizes the new English support API messages without translating unknown user content',()=>{expect(translateSystemMessage('Upload at least one QR image before enabling support','zh')).toBe('请先上传至少一张收款码再启用');expect(translateSystemMessage('My own support note','zh')).toBe('My own support note')});
it('translates only recognized system messages',()=>{expect(translateSystemMessage('验证码错误或已过期','en')).toBe('The verification code is incorrect or expired.');expect(translateSystemMessage('用户自己的中文说明','en')).toBe('用户自己的中文说明');expect(translateSystemMessage('验证码错误或已过期','zh')).toBe('验证码错误或已过期')});
it('renders a recognized error in selected interface language',()=>{localStorage.setItem(localeStorageKey,'en');render(<I18nProvider><SystemMessage text="图片不能超过 10 MB"/></I18nProvider>);expect(screen.getByText('Images must be no larger than 10 MB.')).toBeTruthy()});
