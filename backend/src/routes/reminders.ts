import { Router } from "express";
import prisma from "../prismaClient";

const router = Router();

// GET /api/reminders?includeCompleted=false
router.get("/", async (req, res) => {
  const includeCompleted = req.query.includeCompleted === "true";

  const rows = await prisma.reminder.findMany({
    where: includeCompleted ? {} : { completed: false },
    include: { application: { select: { company: true, position: true } } },
    orderBy: { dueDate: "asc" },
  });

  // adapt shape to previous API (r.*, company, position)
  const adapted = rows.map((r) => ({ ...r, company: r.application?.company ?? null, position: r.application?.position ?? null }));
  res.json(adapted);
});

// POST /api/reminders
router.post("/", async (req, res) => {
  const { application_id, message, due_date } = req.body ?? {};
  if (!application_id || !message || !due_date) {
    return res.status(400).json({ error: "application_id, message, due_date are required" });
  }

  const row = await prisma.reminder.create({ data: { applicationId: application_id, message, dueDate: new Date(due_date) } });
  res.status(201).json(row);
});

// PATCH /api/reminders/:id/complete
router.patch("/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.reminder.update({ where: { id }, data: { completed: true } });
    const row = await prisma.reminder.findUnique({ where: { id } });
    res.json(row);
  } catch (e) {
    res.status(404).json({ error: "Reminder not found" });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.reminder.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    res.status(404).json({ error: "Reminder not found" });
  }
});

export default router;
