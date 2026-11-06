/**
 * The storefront uses a small D1 API surface. Keep its parameterized statements
 * and atomic batches while running them on Netlify's PostgreSQL connection pool.
 * Importing this module never opens a connection.
 */
type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number | null; command?: string; fields?: { name: string }[] };
type Queryable = { query(sql: string, values?: unknown[]): Promise<QueryResult> };
export type PostgresPool = Queryable & { connect(): Promise<Queryable & { release(): void }> };
type Token = { value: string; kind: "word" | "string" | "identifier" | "parameter" | "symbol"; start: number; end: number };
type Plan = { sql: string; parameters: number; command: string; revokeAfterAccountUpdate: boolean; accountUpdate: boolean };

const MAX_ATTEMPTS = 5;
const ACCOUNT_UPDATE = "update admin_accounts set email = ? , password_hash = ? where id = 'admin' and email = ? and password_hash = ? and recovery_email = ?";
const CONDITIONAL_REVOCATION = "delete from admin_sessions where changes ( ) > 0";
const MILLIS_INCREMENT = ["strftime", "(", "'%Y-%m-%dT%H:%M:%fZ'", ",", "updated_at", ",", "'+0.001 seconds'", ")"];

/** Read SQL tokens without mistaking literals, quoted names, or comments for bind parameters. */
function tokens(sql: string): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < sql.length;) {
    const start = i;
    const char = sql[i];
    if (/\s/.test(char)) { i++; continue; }
    if (sql.startsWith("--", i)) { const end = sql.indexOf("\n", i + 2); i = end < 0 ? sql.length : end + 1; continue; }
    if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error("Unterminated SQL comment");
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i++] === char) {
          if (sql[i] === char) { i++; continue; }
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error("Unterminated SQL literal");
      result.push({ value: sql.slice(start, i), kind: char === "'" ? "string" : "identifier", start, end: i });
      continue;
    }
    // PostgreSQL dollar-quoted strings may also contain question marks.
    if (char === "$") {
      const delimiter = /^(?:\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.exec(sql.slice(i))?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, i + delimiter.length);
        if (end < 0) throw new Error("Unterminated SQL dollar literal");
        i = end + delimiter.length;
        result.push({ value: sql.slice(start, i), kind: "string", start, end: i });
        continue;
      }
    }
    if (char === "?") {
      i++;
      while (/\d/.test(sql[i] ?? "")) i++;
      result.push({ value: sql.slice(start, i), kind: "parameter", start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      i++;
      while (/[A-Za-z_0-9$]/.test(sql[i] ?? "")) i++;
      result.push({ value: sql.slice(start, i), kind: "word", start, end: i });
      continue;
    }
    result.push({ value: char, kind: "symbol", start, end: ++i });
  }
  return result;
}

function canonical(parts: Token[]): string {
  return parts.filter((token) => token.value !== ";").map((token) => token.kind === "word" ? token.value.toLowerCase() : token.kind === "parameter" ? "?" : token.value).join(" ");
}

/** Translate only the SQLite constructs actually used by this application. */
function compile(source: string): Plan {
  let sql = source;
  let parts = tokens(sql);
  if (!parts.length || parts.some((token, index) => token.value === ";" && index !== parts.length - 1)) throw new Error("Prepare exactly one SQL statement");
  const normalized = canonical(parts);
  const accountUpdate = normalized === ACCOUNT_UPDATE;
  if (normalized === CONDITIONAL_REVOCATION) return { sql: "DELETE FROM admin_sessions", parameters: 0, command: "DELETE", revokeAfterAccountUpdate: true, accountUpdate: false };
  if (parts.some((token, index) => token.kind === "word" && token.value.toLowerCase() === "changes" && parts[index + 1]?.value === "(")) {
    throw new Error("Only the administrator account batch supports SQLite changes()");
  }
  const edits: { start: number; end: number; value: string }[] = [];
  let ignoreConflicts = false;
  if (parts.slice(0, 4).map((token) => token.value.toLowerCase()).join(" ") === "insert or ignore into") {
    if (parts[4]?.value.toLowerCase() !== "products" || parts[5]?.value !== "(") throw new Error("INSERT OR IGNORE is supported only for product seeding");
    edits.push({ start: parts[0].start, end: parts[2].end, value: "INSERT" });
    ignoreConflicts = true;
  }
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].kind !== "word" || parts[i].value.toLowerCase() !== "strftime") continue;
    const match = parts.slice(i, i + MILLIS_INCREMENT.length);
    if (!MILLIS_INCREMENT.every((value, index) => match[index] && (match[index].kind === "word" ? match[index].value.toLowerCase() : match[index].value) === value)) {
      throw new Error("Unsupported SQLite timestamp expression");
    }
    edits.push({ start: parts[i].start, end: match[match.length - 1].end,
      value: `to_char((updated_at::timestamptz + INTERVAL '0.001 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` });
    i += MILLIS_INCREMENT.length - 1;
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) sql = sql.slice(0, edit.start) + edit.value + sql.slice(edit.end);
  if (ignoreConflicts) {
    parts = tokens(sql);
    if (parts.some((token) => token.kind === "word" && ["conflict", "returning"].includes(token.value.toLowerCase()))) throw new Error("Product seeding cannot include another conflict or returning clause");
    const end = parts[parts.length - 1];
    const at = end.value === ";" ? end.start : end.end;
    sql = sql.slice(0, at) + " ON CONFLICT DO NOTHING" + sql.slice(at);
  }
  let parameters = 0;
  const parameterEdits = tokens(sql).filter((token) => token.kind === "parameter").map((token) => {
    const index = token.value.length > 1 ? Number(token.value.slice(1)) : parameters + 1;
    if (!Number.isSafeInteger(index) || index < 1 || index > 65535) throw new Error("Invalid SQL parameter index");
    parameters = Math.max(parameters, index);
    return { ...token, replacement: `$${index}` };
  });
  for (const token of parameterEdits.reverse()) sql = sql.slice(0, token.start) + token.replacement + sql.slice(token.end);
  return { sql, parameters, command: parts[0].value.toUpperCase(), revokeAfterAccountUpdate: false, accountUpdate };
}

function response<T>(result: QueryResult, command: string, duration: number): D1Result<T> {
  const changes = ["INSERT", "UPDATE", "DELETE"].includes(command) ? (result.rowCount ?? 0) : 0;
  return { success: true, results: result.rows as T[], meta: { changes, duration, changed_db: changes > 0,
    rows_read: result.rows.length, rows_written: changes, last_row_id: 0, size_after: 0 } };
}

function retriable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "40001" || error.code === "40P01");
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (!retriable(error) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10 * 2 ** (attempt - 1), 80) + Math.floor(Math.random() * 10)));
    }
  }
}

export function createPostgresDatabase(pool: PostgresPool): D1Database {
  class Statement {
    readonly plan: Plan;
    readonly values: unknown[];
    constructor(plan: Plan, values: unknown[] = []) { this.plan = plan; this.values = values; }
    bind(...values: unknown[]): D1PreparedStatement { return new Statement(this.plan, values) as unknown as D1PreparedStatement; }
    check() { if (this.values.length !== this.plan.parameters) throw new Error(`SQL expected ${this.plan.parameters} parameters, received ${this.values.length}`); }
    async execute<T>(connection: Queryable, previous?: { statement: Statement; result: D1Result<unknown> }): Promise<D1Result<T>> {
      this.check();
      if (this.plan.revokeAfterAccountUpdate) {
        if (!previous?.statement.plan.accountUpdate) throw new Error("Session revocation must immediately follow its account update in one batch");
        if (!previous.result.meta.changes) return response<T>({ rows: [], rowCount: 0 }, "DELETE", 0);
      }
      const start = performance.now();
      return response<T>(await connection.query(this.plan.sql, this.values), this.plan.command, performance.now() - start);
    }
    async all<T>(): Promise<D1Result<T>> { return retry(() => this.execute<T>(pool)); }
    async run<T>(): Promise<D1Result<T>> { return this.all<T>(); }
    async first<T>(column?: string): Promise<T | null> {
      const result = await this.all<Record<string, unknown>>();
      const row = result.results[0];
      return row ? (column === undefined ? row : row[column]) as T : null;
    }
    async raw<T>(options?: { columnNames?: boolean }): Promise<T[]> {
      const result = await this.all<Record<string, unknown>>();
      const names = Object.keys(result.results[0] ?? {});
      const rows = result.results.map((row) => names.map((name) => row[name]));
      return (options?.columnNames ? [names, ...rows] : rows) as T[];
    }
  }
  const prepare = (sql: string) => new Statement(compile(sql)) as unknown as D1PreparedStatement;
  const batch = async <T>(input: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
    const statements = input.map((statement) => {
      if (!(statement instanceof Statement)) throw new Error("Batch statements must come from the same database adapter");
      statement.check();
      return statement;
    });
    if (!statements.length) return [];
    return retry(async () => {
      const client = await pool.connect();
      try {
        // A snapshot plus SSI prevents two checkout/cancellation batches from
        // committing reservations based on the same old inventory or order state.
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const results: D1Result<T>[] = [];
        for (const [index, statement] of statements.entries()) {
          results.push(await statement.execute<T>(client, index ? { statement: statements[index - 1], result: results[index - 1] } : undefined));
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* Preserve the original error. */ }
        throw error;
      } finally { client.release(); }
    });
  };
  return {
    prepare, batch,
    async exec(sql: string) { const result = await prepare(sql).run(); return { count: 1, duration: result.meta.duration }; },
    withSession() { return { prepare, batch, getBookmark: () => null }; },
    async dump() { throw new Error("Use PostgreSQL backup tooling to export Netlify Database"); },
  } as D1Database;
}
