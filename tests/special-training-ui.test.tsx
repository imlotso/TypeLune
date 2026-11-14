// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SpecialTrainingDialog } from '../src/components/SpecialTrainingDialog';

afterEach(cleanup);
it('chooses a language and an actual personal drill, and supports Escape', () => {
  const select = vi.fn(); const close = vi.fn();
  render(<SpecialTrainingDialog language="zh" onSelect={select} onClose={close} />);
  expect(screen.getByText('素材：自编固定练习')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('专项语言'), { target: { value: 'en' } });
  fireEvent.change(screen.getByLabelText('专项类型'), { target: { value: 'phrases' } });
  expect(screen.getByText(/take a deep breath/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '使用专项' }));
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', title: '英文词组专项', custom: true }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
