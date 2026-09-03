import test from "node:test";
import assert from "node:assert/strict";
import prisma from "./prismaClient";
import { createAuthToken, validateCredentials, verifyToken } from "./auth";

test("valid credentials create a usable token", async () => {
  const credentials = { username: "admin", password: "admin123" };
  const token = createAuthToken(credentials.username);

  assert.equal(await validateCredentials(credentials.username, credentials.password), true);
  assert.equal(verifyToken(token), credentials.username);
});

test("invalid credentials are rejected", async () => {
  assert.equal(await validateCredentials("admin", "wrong-password"), false);
  assert.equal(await validateCredentials("other-user", "admin123"), false);
});

test("default admin user is stored in the database", async () => {
  const row = await prisma.user.findUnique({ where: { username: "admin" } });
  assert.ok(row, "admin user should exist in users table");
  assert.match(row!.passwordHash || "", /:/, "stored password should be hashed");
});
