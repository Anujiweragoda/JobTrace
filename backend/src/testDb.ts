import "dotenv/config";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const client = new Client({ connectionString: url.replace(/^\"|\"$/g, "") });
  try {
    await client.connect();
    console.log("Connected to database.");

    const v = await client.query("SELECT version() as v");
    console.log("Postgres version:", v.rows[0].v);

    const db = await client.query("SELECT current_database() as db");
    console.log("Current database:", db.rows[0].db);

    const schema = await client.query("SELECT current_schema() as schema");
    console.log("Current schema:", schema.rows[0].schema);

    // simple check if applications table exists
    const exists = await client.query(
      `SELECT to_regclass('public.applications') as exists`
    );
    console.log("applications table exists:", exists.rows[0].exists !== null);

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error("Connection/test failed:", err);
    try {
      await client.end();
    } catch {}
    process.exit(2);
  }
}

main();
