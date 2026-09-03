import { Router } from "express";
import prisma from "../prismaClient";

const router = Router();

// GET /api/cv-versions
router.get("/", async (req, res) => {
  const rows = await prisma.cvVersion.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows);
});

// POST /api/cv-versions  (metadata only - name/tag/file_name; no binary upload in this MVP)
router.post("/", async (req, res) => {
  const { name, tag, file_name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const row = await prisma.cvVersion.create({ data: { name, tag: tag ?? null, fileName: file_name ?? null } });
  res.status(201).json(row);
});

// DELETE /api/cv-versions/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.cvVersion.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    res.status(404).json({ error: "CV version not found" });
  }
});

export default router;
