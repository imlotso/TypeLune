// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { FingerGuide } from '../src/components/FingerGuide';
import { I18nProvider } from '../src/lib/i18n';
afterEach(cleanup);
it('labels hands as guidance, localizes controls and supports reduced motion', () => {
 localStorage.setItem('typelune.ui-locale.v1','en');
 const { container, rerender } = render(<I18nProvider><FingerGuide character="F" /></I18nProvider>);
 expect((screen.getByRole('checkbox',{name:'Hands'}) as HTMLInputElement).checked).toBe(true);
 expect(container.querySelector('[data-key="shift-right"].finger-key-active')).toBeTruthy();
 fireEvent.click(screen.getByRole('checkbox',{name:'Reduce motion'}));
 expect(container.querySelector('.finger-guide-static')).toBeTruthy();
 rerender(<I18nProvider><FingerGuide character="J" /></I18nProvider>);
 expect(container.querySelector('[data-key="shift-left"].finger-key-active')).toBeTruthy();
 fireEvent.click(screen.getByRole('checkbox',{name:'Hands'}));
 expect(container.querySelector('.guide-hands')).toBeNull();
});

