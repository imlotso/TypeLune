import { createServer, type Socket } from 'node:net';
import { expect, it } from 'vitest';
import { createApp } from '../server/app';

it('verifies a real local SMTP connection without sending, then sends through SMTP', async () => {
  const messages: string[] = []; const sockets = new Set<Socket>();
  const smtp = createServer((socket) => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.setEncoding('utf8'); socket.write('220 localhost ESMTP\r\n');
    let buffer = ''; let collecting = false; let content: string[] = [];
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (collecting) {
          if (line === '.') { messages.push(content.join('\r\n')); content = []; collecting = false; socket.write('250 Message accepted\r\n'); }
          else content.push(line);
          continue;
        }
        const command = line.split(' ')[0].toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (command === 'DATA') { collecting = true; socket.write('354 End data with <CR><LF>.<CR><LF>\r\n'); }
        else if (command === 'QUIT') { socket.end('221 Bye\r\n'); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  const port = (smtp.address() as { port: number }).port;
  const app = await createApp({ databasePath: ':memory:', secureCookies: false, adminEmail: 'owner@example.test',
    smtp: { host: '127.0.0.1', port, security: 'opportunistic', from: 'sender@example.test', username: '', password: '' } });
  try {
    const codeResponse = await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'owner@example.test', purpose: 'register' } });
    expect(codeResponse.statusCode).toBe(200);
    expect(messages).toHaveLength(1);
    const body = messages[0].split('\r\n\r\n').slice(1).join('\r\n\r\n');
    const encoding = messages[0].match(/^Content-Transfer-Encoding:\s*(\S+)/imu)?.[1].toLowerCase();
    const decoded = encoding === 'base64' ? Buffer.from(body.replace(/\s/gu, ''), 'base64').toString('utf8') :
      encoding === 'quoted-printable' ? Buffer.from(body.replace(/=\r\n/gu, '').replace(/=([a-f0-9]{2})/giu, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8') : body;
    const code = decoded.match(/\b\d{6}\b/u)?.[0];
    expect(!!code).toBe(true);
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'owner', email: 'owner@example.test', password: 'test-password-123', code } });
    expect(registration.statusCode).toBe(200);
    const headers = { cookie: `session=${registration.cookies.find((cookie) => cookie.name === 'session')!.value}` };
    const verified = await app.inject({ method: 'POST', url: '/api/admin/smtp/verify', headers, payload: { revision: 0 } });
    expect(verified.statusCode).toBe(200);
    expect(messages).toHaveLength(1);
    const delivered = await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'reader@example.test', purpose: 'register' } });
    expect(delivered.statusCode).toBe(200);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain('reader@example.test');
    expect(messages[1]).toContain('TypeLune');
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    const unavailable = await app.inject({ method: 'POST', url: '/api/admin/smtp/verify', headers, payload: { revision: 0 } });
    expect(unavailable.statusCode).toBe(502);
  } finally {
    await app.close();
    for (const socket of sockets) socket.destroy();
    if (smtp.listening) await new Promise<void>((resolve) => smtp.close(() => resolve()));
  }
}, 20_000);
