export const usernameRule = '用户名须为 3–24 位字母、数字、下划线或连字符';
export const passwordRule = '密码须为 10–128 个字符';

export const isValidUsername = (value: string) => /^[\p{L}\p{N}_-]{3,24}$/u.test(value);
export const isValidPassword = (value: string) => value.length >= 10 && value.length <= 128;
import { splitCharacters } from './scoring';

export const isValidDisplayName = (value: string) => {
  const length = splitCharacters(value).length;
  return length >= 1 && length <= 24 && !/[\p{Cc}\p{Cf}]/u.test(value);
};
