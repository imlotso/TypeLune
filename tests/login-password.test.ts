import { afterEach, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { verifyLoginPassword } from '../server/login-password';

afterEach(() => vi.restoreAllMocks());

it('performs password verification for unknown accounts and never authenticates the sentinel', async () => {
  const verify = vi.spyOn(argon2, 'verify').mockResolvedValue(true);
  expect(await verifyLoginPassword(undefined, 'supplied-password')).toBe(false);
  expect(verify).toHaveBeenCalledWith(expect.stringMatching(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/), 'supplied-password');
});

it('uses the account hash and accepts only a verified password', async () => {
  const verify = vi.spyOn(argon2, 'verify').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await verifyLoginPassword('account-hash', 'correct')).toBe(true);
  expect(await verifyLoginPassword('account-hash', 'incorrect')).toBe(false);
  expect(verify.mock.calls).toEqual([['account-hash', 'correct'], ['account-hash', 'incorrect']]);
});
