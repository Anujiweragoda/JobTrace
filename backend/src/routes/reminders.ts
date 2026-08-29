import { Router } from "express";
import db from "../db";

const router = Router();

// GET /api/reminders?includeCompleted=false
router.get("/", (req, res) => {
  const includeCompleted = req.query.includeCompleted === "true";

  const sql = `
    SELECT r.*, a.company, a.position
    FROM reminders r
    JOIN applications a ON a.id = r.application_id
    ${includeCompleted ? "" : "WHERE r.completed = 0"}
    ORDER BY r.due_date ASC
  `;

  const rows = db.prepare(sql).all();
  res.json(rows);
});

// POST /api/reminders
router.post("/", (req, res) => {
  const { application_id, message, due_date } = req.body ?? {};
  if (!application_id || !message || !due_date) {
    return res.status(400).json({ error: "application_id, message, due_date are required" });
  }

  const info = db
    .prepare("INSERT INTO reminders (application_id, message, due_date) VALUES (?, ?, ?)")
    .run(application_id, message, due_date);

  const row = db.prepare("SELECT * FROM reminders WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// PATCH /api/reminders/:id/complete
router.patch("/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("UPDATE reminders SET completed = 1 WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Reminder not found" });
  res.json(db.prepare("SELECT * FROM reminders WHERE id = ?").get(id));
});

// DELETE /api/reminders/:id
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Reminder not found" });
  res.status(204).send();
});

export default router;
