import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { dbConfig, sql } from "./pool.js";

// Chạy lần lượt các tệp db/migrations/*.sql chưa chạy; mỗi tệp chạy trong một transaction
// và được ghi vào bảng schema_migrations nên chỉ chạy đúng một lần.
// Mặc định: <repo>/db/migrations (cả khi chạy từ src/ lẫn dist/); có thể ghi đè bằng MIGRATIONS_DIR.
export const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../db/migrations");

// Tách tệp theo dòng "GO" giống sqlcmd / SSMS (GO không phải lệnh T-SQL).
export function splitBatches(script: string): string[] {
  return script
    .split(/^\s*GO\s*;?\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function ensureDatabase(): Promise<void> {
  const master = await new sql.ConnectionPool(dbConfig("master")).connect();
  try {
    // Tên CSDL đã được kiểm tra bằng regex trong env.ts nên an toàn khi ghép vào lệnh.
    await master
      .request()
      .input("name", sql.NVarChar, env.DB_NAME)
      .batch(`IF DB_ID(@name) IS NULL CREATE DATABASE [${env.DB_NAME}];`);
  } finally {
    await master.close();
  }
}

export async function migrate(log: (msg: string) => void = console.log): Promise<string[]> {
  await ensureDatabase();
  const pool = await new sql.ConnectionPool(dbConfig()).connect();
  const applied: string[] = [];
  try {
    await pool.request().batch(`
      IF OBJECT_ID('dbo.schema_migrations', 'U') IS NULL
        CREATE TABLE dbo.schema_migrations (
          file_name  NVARCHAR(200) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
          applied_at DATETIME2(0) NOT NULL CONSTRAINT DF_schema_migrations_applied DEFAULT SYSUTCDATETIME()
        );`);
    const done = new Set(
      (await pool.request().query<{ file_name: string }>("SELECT file_name FROM dbo.schema_migrations")).recordset.map(
        (r) => r.file_name,
      ),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const batches = splitBatches(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        for (const batch of batches) await new sql.Request(tx).batch(batch);
        await new sql.Request(tx)
          .input("file", sql.NVarChar, file)
          .query("INSERT INTO dbo.schema_migrations (file_name) VALUES (@file)");
        await tx.commit();
        applied.push(file);
        log(`✔ ${file}`);
      } catch (err) {
        await tx.rollback();
        throw new Error(`Migration ${file} thất bại: ${(err as Error).message}`);
      }
    }
    if (applied.length === 0) log("Không có migration mới.");
    return applied;
  } finally {
    await pool.close();
  }
}

// Chạy trực tiếp: npm run db:migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate().catch((err: unknown) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
