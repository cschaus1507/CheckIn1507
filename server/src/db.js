import pg from "pg";

// Force Postgres DATE (OID 1082) to come back as a plain 'YYYY-MM-DD' string.
// This prevents timezone shifts (e.g., showing the prior day) when dates are sent to the client.
pg.types.setTypeParser(1082, (val) => val);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});
