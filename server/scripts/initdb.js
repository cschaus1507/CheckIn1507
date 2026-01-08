import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

function splitSql(sql) {
  // Remove single-line comments first
  const noComments = sql.replace(/--.*$/gm, "");

  return noComments
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
}

async function runFile(pool, relPath) {
  const filePath = path.resolve(relPath);
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = splitSql(sql);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log(`✅ Ran ${relPath} (${statements.length} statements)`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
  });

  try {
    await runFile(pool, "./schema.sql");

    // Optional seed (only if you want it):
    // await runFile(pool, "./seed.sql");

    console.log("🎉 Database initialized.");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("❌ initdb failed:", err);
  process.exit(1);
});
