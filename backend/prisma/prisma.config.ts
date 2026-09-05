import dotenv from "dotenv";
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "";

export const adapter = {
  provider: "postgresql",
  url: databaseUrl,
};

export default { adapter };
