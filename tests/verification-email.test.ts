import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { verificationEmail } from '../server/verification-email';

describe('TypeLune verification email', () => {
  it.each([['register', '注册账号'], ['login', '登录账号'], ['reset', '重置密码'], ['change-email', '更换邮箱']])('labels %s consistently in HTML and plain text', (purpose, label) => {
    const mail = verificationEmail('sender@example.test', '123456', purpose);
    expect(mail.from).toEqual({ name: 'TypeLune', address: 'sender@example.test' });
    expect(mail.subject).toBe(`TypeLune · ${label}验证码`);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain(label); expect(body).toContain('123456');
      expect(body).toContain('10 分钟内有效'); expect(body).toContain('如果这不是你的操作，请忽略此邮件');
      expect(body).toContain('请勿将验证码分享给他人');
    }
    expect(mail.html).not.toMatch(/<script|<img|https?:\/\//);
  });
  it('replaces only the display name of an existing formatted sender', () => {
    expect(verificationEmail('Old Name <sender@example.test>', '123456', 'login').from)
      .toEqual({ name: 'TypeLune', address: 'sender@example.test' });
  });
  it.each(['a@example.test,b@example.test', 'a@example.test\r\nBcc: b@example.test', ''])('rejects ambiguous sender %j', (from) => {
    expect(() => verificationEmail(from, '123456', 'login')).toThrow();
  });
  it('rejects HTML or invalid codes', () => {
    expect(() => verificationEmail('sender@example.test', '<img>', 'login')).toThrow();
  });
  it('builds multipart mail with the branded From and unchanged envelope address without a network connection', async () => {
    const result = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
      ...verificationEmail('sender@example.test', '123456', 'login'), to: 'recipient@example.test',
    });
    const wire = result.message.toString();
    expect(wire).toContain('From: TypeLune <sender@example.test>');
    expect(result.envelope.from).toBe('sender@example.test');
    expect(wire).toContain('multipart/alternative');
    expect(wire).toContain('Content-Type: text/plain'); expect(wire).toContain('Content-Type: text/html');
  });
});
