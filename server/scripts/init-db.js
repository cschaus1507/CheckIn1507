import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const schemaPath = path.join(__dirname, "..", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  console.log("Connecting to database...");
  await client.connect();

  console.log("Running schema.sql...");
  await client.query(schemaSql);

  console.log("✅ Database initialized successfully");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});
