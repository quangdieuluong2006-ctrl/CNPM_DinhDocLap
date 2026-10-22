import { migrate } from "../../src/db/migrate.js";
import { dbConfig, sql } from "../../src/db/pool.js";
import { seed } from "../../src/db/seed.js";

// Xóa và tạo lại DinhDocLapDB_test, chạy migration + seed. Mỗi file test tích hợp gọi một lần.
export async function resetTestDb(): Promise<void> {
  const master = await new sql.ConnectionPool(dbConfig("master")).connect();
  await master.request().batch(`
    IF DB_ID('DinhDocLapDB_test') IS NOT NULL
    BEGIN
      ALTER DATABASE DinhDocLapDB_test SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE DinhDocLapDB_test;
    END`);
  await master.close();
  await migrate(() => {});
  await seed(() => {});
}

export const runDbTests = process.env.RUN_DB_TESTS === "1";
