import { del, get, put } from "@vercel/blob";
import { Router } from "express";
import multer from "multer";
import prisma from "../prismaClient";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

// GET /api/cv-versions
router.get("/", async (req, res) => {
  const rows = await prisma.cvVersion.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows);
});

// POST /api/cv-versions
router.post("/", upload.single("file"), async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const tag = String(req.body?.tag ?? "").trim();
  const file = req.file;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (file && file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Only PDF files are supported" });
  }

  const row = await prisma.cvVersion.create({
    data: {
      name,
      tag: tag || null,
      fileName: file?.originalname ?? null,
      fileSize: file?.size ?? null,
      mimeType: file?.mimetype ?? null,
    },
  });

  if (!file) return res.status(201).json(row);

  try {
    const blob = await put(`cv-versions/${row.id}/${file.originalname}`, file.buffer, {
      access: "private",
      contentType: file.mimetype,
      addRandomSuffix: true,
    });
    const updated = await prisma.cvVersion.update({
      where: { id: row.id },
      data: { filePath: blob.pathname },
    });
    return res.status(201).json(updated);
  } catch (error) {
    await prisma.cvVersion.delete({ where: { id: row.id } }).catch(() => undefined);
    console.error("CV upload failed", error);
    return res.status(502).json({ error: "Could not upload the CV PDF" });
  }
});

// GET /api/cv-versions/:id/file
router.get("/:id/file", async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.cvVersion.findUnique({ where: { id } });
  if (!row?.filePath) return res.status(404).json({ error: "CV PDF not found" });

  const result = await get(row.filePath, { access: "private" });
  if (!result) return res.status(404).json({ error: "CV PDF not found" });
  res.setHeader("Content-Type", row.mimeType ?? "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.fileName ?? "cv.pdf")}`);
  if (!result.stream) return res.status(404).json({ error: "CV PDF stream unavailable" });
  for await (const chunk of result.stream) res.write(chunk);
  return res.end();
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
