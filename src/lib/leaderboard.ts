import { splitCharacters } from './scoring.js';

export const guestNicknamePrefix = 'visitor';
export const maxGuestNicknameLength = 16;

export function validGuestNickname(value: string) {
  const nickname = value.trim();
  return nickname.startsWith(guestNicknamePrefix) && splitCharacters(nickname).length <= maxGuestNicknameLength && !/[\p{Cc}\p{Cf}]/u.test(nickname);
}
