import sql from "mssql";
import { env } from "../config/env.js";

export { sql };

export function dbConfig(database = env.DB_NAME): sql.config {
  return {
    server: env.DB_SERVER,
    port: env.DB_PORT,
    database,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
    },
  };
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

// Một connection pool dùng chung cho cả ứng dụng.
export function getPool(): Promise<sql.ConnectionPool> {
  poolPromise ??= new sql.ConnectionPool(dbConfig()).connect().catch((err: unknown) => {
    poolPromise = undefined;
    throw err;
  });
  return poolPromise;
}

export async function closePool(): Promise<void> {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = undefined;
  await pool.close();
}
