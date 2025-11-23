import sql from "mssql";
import * as dotenv from "dotenv";

dotenv.config();

const config: sql.config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE!,
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  
  try {
    pool = await sql.connect(config);
    console.log("✅ Conectado ao Azure SQL");
    return pool;
  } catch (error) {
    console.error("❌ Erro ao conectar ao banco:", error);
    throw error;
  }
}

process.on("SIGINT", async () => {
  if (pool) {
    await pool.close();
    console.log("🔌 Conexão fechada");
  }
  process.exit(0);
});