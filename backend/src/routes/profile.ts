import { Router } from "express";
import { updateUser } from "../auth";
import prisma from "../prismaClient";

const router = Router();

// GET /api/profile
router.get("/", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true, createdAt: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ user });
});

// PUT /api/profile
router.put("/", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const { username, password } = req.body ?? {};
  try {
    const updated = await updateUser(userId, username, password);
    res.json({ user: updated });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed to update profile" });
  }
});

export default router;
