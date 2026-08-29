import { Router } from "express";
import db from "../db";

const router = Router();

// GET /api/cv-versions
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM cv_versions ORDER BY created_at DESC").all();
  res.json(rows);
});

// POST /api/cv-versions  (metadata only - name/tag/file_name; no binary upload in this MVP)
router.post("/", (req, res) => {
  const { name, tag, file_name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const info = db
    .prepare("INSERT INTO cv_versions (name, tag, file_name) VALUES (?, ?, ?)")
    .run(name, tag ?? null, file_name ?? null);

  const row = db.prepare("SELECT * FROM cv_versions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// DELETE /api/cv-versions/:id
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM cv_versions WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "CV version not found" });
  res.status(204).send();
});

export default router;
