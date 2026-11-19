import { expect, it } from 'vitest';
import { compilePostgresSql } from '../server/postgres/sql';

it('binds positional and repeated named values without altering quoted text or comments', () => {
  expect(compilePostgresSql("SELECT '?' AS marker, @name AS displayName -- ?\nWHERE (@name IS NULL OR name=@name) AND n>?", [{ name: 'Alice' }, 3])).toEqual({
    text: "SELECT '?' AS \"marker\", $1 AS \"displayName\" -- ?\nWHERE ($2::text IS NULL OR name=$3) AND n>$4",
    values: ['Alice', 'Alice', 'Alice', 3],
  });
});

it('translates the SQLite operations used by existing stores without interpolating parameters', () => {
  expect(compilePostgresSql('INSERT OR IGNORE INTO x(id) VALUES (?)', ["x'); DROP TABLE x;--"])).toEqual({
    text: 'INSERT INTO x(id) VALUES ($1) ON CONFLICT DO NOTHING', values: ["x'); DROP TABLE x;--"],
  });
  expect(compilePostgresSql('SELECT instr(name,?), length(CAST(value AS BLOB)), MAX(missing_client_checkpoint_time,?) AS n', ['a', 1]).text)
    .toBe('SELECT strpos(name,$1), octet_length(value), GREATEST(missing_client_checkpoint_time,$2) AS "n"');
});

it('leaves nested comments, dollar quotes, escape strings and Unicode bound data intact', () => {
  const query = String.raw`SELECT $$body ? @tag$$, $notes$MAX(missing_client_checkpoint_time,?)$notes$, E'quoted\' ?' /* outside /* ? */ @tag */, @label AS label, ?`;
  const label = '臺灣 café 👩‍💻 ? @label';
  expect(compilePostgresSql(query, [{ label }, 42])).toEqual({
    text: query.replace('@label AS label, ?', '$1 AS "label", $2'),
    values: [label, 42],
  });
  expect(compilePostgresSql("SELECT 'length(CAST(value AS BLOB))', ? -- ?\r\n WHERE n=@n", [{ n: 2 }, '$&'])).toEqual({
    text: "SELECT 'length(CAST(value AS BLOB))', $1 -- ?\r\n WHERE n=$2", values: ['$&', 2],
  });
});

it('rejects missing bindings and ambiguous or unterminated SQL templates', () => {
  expect(() => compilePostgresSql('SELECT ?, @label', [1])).toThrow('Missing named SQL parameter');
  expect(() => compilePostgresSql('SELECT ? /* outer /* inner */', [1])).toThrow('Unterminated SQL comment');
  expect(() => compilePostgresSql('SELECT $body$ text', [])).toThrow('Unterminated SQL dollar-quoted text');
  expect(() => compilePostgresSql('SELECT $1, ?', [1])).toThrow('Native PostgreSQL parameters');
});
