import bcrypt from "bcryptjs";
import { migrate } from "../../src/db/migrate.js";
import { dbConfig, sql } from "../../src/db/pool.js";
import { seed } from "../../src/db/seed.js";

// Tài khoản có mật khẩu, vai trò user – CHỈ có trong CSDL test (seed v2.0 không tạo nữa).
// Dùng để kiểm tra luồng đăng nhập/làm mới/khóa của người dùng không phải admin bằng email cố định.
export const TEST_USERS = [
  { email: "user1@test.vn", fullName: "Nguyễn Văn An" },
  { email: "user2@test.vn", fullName: "Trần Thị Bình" },
  { email: "user3@test.vn", fullName: "Lê Hoàng Cường" },
  { email: "user4@test.vn", fullName: "Phạm Minh Dũng" },
  { email: "user5@test.vn", fullName: "Hoàng Thu Hà" },
  { email: "user6@test.vn", fullName: "Vũ Đức Khang" },
] as const;

// Xóa và tạo lại DinhDocLapDB_test, chạy migration + seed, thêm TEST_USERS. Mỗi file test tích hợp gọi một lần.
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
  const pool = await new sql.ConnectionPool(dbConfig()).connect();
  const hash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "Demo@12345", 4);
  for (const u of TEST_USERS) {
    await pool.request().input("email", sql.NVarChar(255), u.email).input("name", sql.NVarChar(100), u.fullName)
      .input("hash", sql.NVarChar(255), hash)
      .query("INSERT INTO dbo.users (email, password_hash, full_name, role, narration_lang) VALUES (@email, @hash, @name, 'user', 'vi');");
  }
  await pool.close();
}

export const runDbTests = process.env.RUN_DB_TESTS === "1";
