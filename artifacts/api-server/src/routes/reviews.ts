import { Router, type IRouter } from "express";
import { z } from "zod";
import { agentReviewInvitationsTable, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { jsonify } from "../lib/helpers";
import {
  createReviewFromToken,
  getReviewInvitationByToken,
  invitationIsExpired,
  retryReviewInvitation,
} from "../lib/agent-reviews";
import { requireRole } from "./auth";

const router: IRouter = Router();
const reviewSubmissionSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().trim().min(10, "Please share at least 10 characters.").max(600),
});

router.get("/public/reviews/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    res.status(404).json({ status: "invalid" });
    return;
  }
  const record = await getReviewInvitationByToken(token);
  if (!record) {
    res.status(404).json({ status: "invalid" });
    return;
  }
  if (invitationIsExpired(record.invitation)) {
    res.status(410).json({ status: "expired" });
    return;
  }
  if (record.invitation.status === "submitted") {
    res.status(410).json({ status: "used" });
    return;
  }
  res.json({
    status: "available",
    agent: { name: record.agentName },
    property: { reference: record.propertyReference, title: record.propertyTitle },
    outcome: record.invitation.outcome,
    expiresAt: record.invitation.expiresAt.toISOString(),
  });
});

router.post("/public/reviews/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    res.status(404).json({ status: "invalid" });
    return;
  }
  const parsed = reviewSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid review." });
    return;
  }
  const result = await createReviewFromToken(token, parsed.data);
  if (result.kind === "not_found") {
    res.status(404).json({ status: "invalid" });
    return;
  }
  if (result.kind === "expired") {
    res.status(410).json({ status: "expired" });
    return;
  }
  if (result.kind === "used") {
    res.status(410).json({ status: "used" });
    return;
  }
  res.status(201).json({ success: true, review: jsonify(result.review) });
});

router.post("/admin/reviews/invitations/:id/retry", requireRole("principal", "admin"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid invitation id" });
    return;
  }
  const invitation = await retryReviewInvitation(id);
  if (!invitation) {
    const [existing] = await db.select({ id: agentReviewInvitationsTable.id })
      .from(agentReviewInvitationsTable)
      .where(and(
        eq(agentReviewInvitationsTable.id, id),
        eq(agentReviewInvitationsTable.status, "submitted"),
      ))
      .limit(1);
    res.status(existing ? 409 : 404).json({
      error: existing ? "A submitted invitation cannot be retried." : "Invitation not found or not retryable.",
    });
    return;
  }
  res.json({ ok: true, invitationId: invitation.id, status: invitation.status });
});

export default router;