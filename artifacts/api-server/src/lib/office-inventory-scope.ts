import { and, eq } from "drizzle-orm";
import {
  branchesTable,
  businessAgenciesTable,
  db,
} from "@workspace/db";

export type OfficeInventoryBranch = {
  id: number;
  agencyId: number | null;
  status: string;
};

export type OfficeInventoryAgencyBranch = {
  id: number;
  agencyId: number | null;
  status: string;
};

export function getActiveAgencyBranchIds(
  memberBranchId: number | null | undefined,
  memberBranch: OfficeInventoryBranch | undefined,
  agencyStatus: string | undefined,
  agencyBranches: OfficeInventoryAgencyBranch[],
): number[] | undefined {
  if (
    memberBranchId == null ||
    !memberBranch ||
    memberBranch.id !== memberBranchId ||
    memberBranch.status !== "active" ||
    memberBranch.agencyId == null ||
    agencyStatus !== "active"
  ) {
    return undefined;
  }

  const activeBranchIds = agencyBranches
    .filter((branch) => branch.agencyId === memberBranch.agencyId && branch.status === "active")
    .map((branch) => branch.id);
  return activeBranchIds.includes(memberBranchId) ? activeBranchIds : undefined;
}

export async function getActiveAgencyBranchIdsForUser(
  branchId: number | null | undefined,
): Promise<number[] | undefined> {
  if (branchId == null) return undefined;

  const [memberBranch] = await db.select({
    id: branchesTable.id,
    agencyId: branchesTable.agencyId,
    status: branchesTable.status,
  }).from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
  if (!memberBranch || memberBranch.agencyId == null) return undefined;

  const [agency] = await db.select({
    status: businessAgenciesTable.status,
  }).from(businessAgenciesTable)
    .where(eq(businessAgenciesTable.id, memberBranch.agencyId))
    .limit(1);
  if (agency?.status !== "active") return undefined;

  const agencyBranches = await db.select({
    id: branchesTable.id,
    agencyId: branchesTable.agencyId,
    status: branchesTable.status,
  }).from(branchesTable).where(and(
    eq(branchesTable.agencyId, memberBranch.agencyId),
    eq(branchesTable.status, "active"),
  ));

  return getActiveAgencyBranchIds(branchId, memberBranch, agency.status, agencyBranches);
}
