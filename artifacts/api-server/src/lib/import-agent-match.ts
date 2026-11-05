export type ImportAgentCandidate = {
  id: number;
  name: string;
  branchId: number | null;
};

function nameTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function matchImportAgentByName(
  sourceName: string,
  agents: ImportAgentCandidate[],
  branchId: number,
): ImportAgentCandidate | null {
  const sourceTokens = nameTokens(sourceName);
  if (sourceTokens.length < 2) return null;

  const branchAgents = agents.filter((agent) => agent.branchId === branchId);
  const normalizedSource = sourceTokens.join(" ");
  const exactMatches = branchAgents.filter((agent) => nameTokens(agent.name).join(" ") === normalizedSource);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return null;

  // A source such as "T. Sachikunda" can identify "Trish Sachikunda",
  // but only when that initial and surname resolve to one branch agent.
  if (sourceTokens[0].length !== 1) return null;
  const sourceSurname = sourceTokens[sourceTokens.length - 1];
  const initialMatches = branchAgents.filter((agent) => {
    const candidateTokens = nameTokens(agent.name);
    return candidateTokens.length >= 2
      && candidateTokens[0].startsWith(sourceTokens[0])
      && candidateTokens[candidateTokens.length - 1] === sourceSurname;
  });

  return initialMatches.length === 1 ? initialMatches[0] : null;
}
