import { useEffect, useRef } from 'react';

export type ShortcutAction = 'pause' | 'restart' | 'settings' | 'commands' | 'practice' | 'library' | 'rankings' | 'history';
export const shortcutNames: Record<ShortcutAction, string> = { pause: 'Alt+P', restart: 'Alt+R', settings: 'Alt+S', commands: 'Alt+K',
  practice: 'Ctrl+Shift+1', library: 'Ctrl+Shift+2', rankings: 'Ctrl+Shift+3', history: 'Ctrl+Shift+4' };

export function useShortcuts(enabled: boolean, dispatch: (action: ShortcutAction) => boolean) {
  const callback = useRef(dispatch); callback.current = dispatch;
  useEffect(() => {
    if (!enabled) return;
    let composing = false;
    let compositionTarget: EventTarget | null = null;
    const start = (event: CompositionEvent) => { composing = true; compositionTarget = event.target; };
    const end = () => { composing = false; compositionTarget = null; };
    const focus = (event: FocusEvent) => { if (composing && event.target !== compositionTarget) end(); };
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || event.getModifierState('AltGraph') || composing || document.querySelector('[role="dialog"]')) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      const editable = target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      if (editable && !editable.hasAttribute('data-practice-input')) return;
      let action: ShortcutAction | undefined;
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (event.key.toLowerCase() === event.code.slice(3).toLowerCase()) action = ({ KeyP: 'pause', KeyR: 'restart', KeyS: 'settings', KeyK: 'commands' } as Record<string, ShortcutAction>)[event.code];
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
        action = ({ Digit1: 'practice', Digit2: 'library', Digit3: 'rankings', Digit4: 'history' } as Record<string, ShortcutAction>)[event.code];
      }
      if (action && callback.current(action)) event.preventDefault();
    };
    document.addEventListener('compositionstart', start, true);
    document.addEventListener('compositionend', end, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('keydown', keydown);
    window.addEventListener('blur', end);
    return () => { document.removeEventListener('compositionstart', start, true); document.removeEventListener('compositionend', end, true); document.removeEventListener('focusin', focus, true); document.removeEventListener('keydown', keydown); window.removeEventListener('blur', end); };
  }, [enabled]);
}
