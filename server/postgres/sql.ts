function quotedEnd(sql: string, start: number, escapes: boolean) {
  const quote = sql[start];
  for (let i = start + 1; i < sql.length; i++) {
    if (escapes && sql[i] === '\\') { i++; continue; }
    if (sql[i] !== quote) continue;
    if (sql[i + 1] === quote) { i++; continue; }
    return i + 1;
  }
  throw new Error('Unterminated SQL quoted text');
}

function commentEnd(sql: string, start: number) {
  let depth = 1;
  for (let i = start + 2; i < sql.length - 1; i++) {
    const pair = sql.slice(i, i + 2);
    if (pair === '/*') { depth++; i++; }
    else if (pair === '*/') {
      if (--depth === 0) return i + 2;
      i++;
    }
  }
  throw new Error('Unterminated SQL comment');
}

/** Compile the SQLite-style bound placeholders used by the existing stores. */
export function compilePostgresSql(input: string, args: unknown[]) {
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(input);
  const sql = ignore ? input.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO').replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING' : input;
  const named = args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) && !Buffer.isBuffer(args[0])
    ? args[0] as Record<string, unknown> : undefined;
  let position = named ? 1 : 0;
  const values: unknown[] = [];
  let out = '';
  let alias = false;
  for (let i = 0; i < sql.length;) {
    const char = sql[i];
    const escapeLiteral = /^[eE]$/.test(char) && sql[i + 1] === "'";
    if (char === "'" || char === '"' || escapeLiteral) {
      const end = quotedEnd(sql, escapeLiteral ? i + 1 : i, escapeLiteral);
      out += sql.slice(i, end); i = end; alias = false; continue;
    }
    if (char === '-' && sql[i + 1] === '-') {
      const end = sql.slice(i).search(/[\r\n]/);
      const next = end < 0 ? sql.length : i + end;
      out += sql.slice(i, next); i = next; continue;
    }
    if (char === '/' && sql[i + 1] === '*') {
      const end = commentEnd(sql, i);
      out += sql.slice(i, end); i = end; continue;
    }
    if (char === '$') {
      const delimiter = /^\$(?:[a-z_][a-z0-9_]*)?\$/i.exec(sql.slice(i))?.[0];
      if (delimiter) {
        const close = sql.indexOf(delimiter, i + delimiter.length);
        if (close < 0) throw new Error('Unterminated SQL dollar-quoted text');
        const end = close + delimiter.length;
        out += sql.slice(i, end); i = end; alias = false; continue;
      }
      if (/\d/.test(sql[i + 1] ?? '')) throw new Error('Native PostgreSQL parameters belong in direct queries');
    }
    if (char === '?' || char === '@' && /[a-z_]/i.test(sql[i + 1] ?? '')) {
      let value: unknown;
      let end = i + 1;
      if (char === '?') {
        if (position >= args.length) throw new Error('Missing SQL parameter');
        value = args[position++];
      } else {
        while (/[a-z0-9_]/i.test(sql[end] ?? '')) end++;
        const key = sql.slice(i + 1, end);
        if (!named || !Object.hasOwn(named, key)) throw new Error('Missing named SQL parameter');
        value = named[key];
      }
      values.push(value);
      out += '$' + values.length + (/^\s+IS\s+(?:NOT\s+)?NULL\b/i.test(sql.slice(end)) ? '::text' : '');
      i = end; alias = false; continue;
    }
    if (/[a-z_]/i.test(char)) {
      let end = i + 1;
      while (/[a-z0-9_]/i.test(sql[end] ?? '')) end++;
      const word = sql.slice(i, end);
      if (alias) { out += `"${word}"`; alias = false; }
      else if (/^instr$/i.test(word) && /^\s*\(/.test(sql.slice(end))) out += 'strpos';
      else if (/^length$/i.test(word)) {
        const lengthCast = /^\s*\(\s*CAST\s*\(\s*value\s+AS\s+BLOB\s*\)\s*\)/i.exec(sql.slice(end));
        out += lengthCast ? 'octet_length(value)' : word;
        if (lengthCast) end += lengthCast[0].length;
      } else if (/^max$/i.test(word) && /^\s*\(\s*missing_client_checkpoint_time\s*,\s*\?\s*\)/i.test(sql.slice(end))) out += 'GREATEST';
      else { out += word; alias = /^AS$/i.test(word); }
      i = end; continue;
    }
    out += char;
    if (!/\s/.test(char)) alias = false;
    i++;
  }
  return { text: out, values };
}
