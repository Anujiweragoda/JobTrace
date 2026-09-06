import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse one client across warm serverless invocations to avoid exhausting the
// hosted Postgres connection pool during concurrent API requests.
const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;

export default prisma;

export async function disconnectPrisma() {
  if (process.env.NODE_ENV !== "production") {
    await prisma.$disconnect();
  }
}
