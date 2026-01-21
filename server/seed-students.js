import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const seedPath = path.join(__dirname, "..", "seed.sql");
  const seedSql = fs.readFileSync(seedPath, "utf8");

  console.log("Connecting to database...");
  await client.connect();

  console.log("Seeding students...");
  await client.query(seedSql);

  console.log("✅ Student seed completed");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
