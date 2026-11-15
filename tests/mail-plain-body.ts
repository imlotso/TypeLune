/** Extract the generated text/plain base64 part (no external mail is parsed). */
export function plainMailBody(message: string) {
  const part = message.split(/\r?\n--[^\r\n]+\r?\n/).find((value) => /Content-Type: text\/plain/i.test(value)) ?? message;
  const body = part.split(/\r?\n\r?\n/).slice(1).join('\n').split(/\r?\n--/)[0];
  return /Content-Transfer-Encoding: base64/i.test(part)
    ? Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8') : body;
}
