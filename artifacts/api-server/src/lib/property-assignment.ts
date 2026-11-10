const AGENT_ROLES = new Set(["agent", "senior_agent"]);
const ASSIGNMENT_ADMIN_ROLES = new Set(["admin", "principal"]);

export type PropertyAssignmentActor = {
  id: number;
  role: string;
} | null | undefined;

export function canAssignPropertyToAgent(
  actor: PropertyAssignmentActor,
  targetAgentId: number,
): boolean {
  if (!actor || !Number.isInteger(targetAgentId) || targetAgentId < 1) return false;
  if (AGENT_ROLES.has(actor.role)) return actor.id === targetAgentId;
  return ASSIGNMENT_ADMIN_ROLES.has(actor.role);
}
