import { expect, it } from 'vitest';
import { fingerTarget } from '../src/lib/finger-guide';
it('uses opposite Shift for letters and symbols', () => {
 expect(fingerTarget('F')).toMatchObject({ hand: 'left', finger: 'index', shift: 'right', key: 'f' });
 expect(fingerTarget('J')).toMatchObject({ hand: 'right', finger: 'index', shift: 'left', key: 'j' });
 expect(fingerTarget('?')).toMatchObject({ hand: 'right', finger: 'little', shift: 'left', key: '/' });
 expect(fingerTarget('!')).toMatchObject({ hand: 'left', finger: 'little', shift: 'right', key: '1' });
});
it('covers whitespace and does not invent unsupported key guidance', () => {
 expect(fingerTarget(' ')).toMatchObject({ key: 'space', finger: 'thumb', shift: null });
 expect(fingerTarget('\n')).toMatchObject({ key: 'enter', finger: 'little', hand: 'right' });
 expect(fingerTarget('中')).toBeUndefined(); expect(fingerTarget(undefined)).toBeUndefined();
});
