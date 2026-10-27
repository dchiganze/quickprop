import directoryData from "../data/eac-registered-agencies.json";

export interface EacAgencyOption {
  id: string;
  name: string;
  location: string;
  phones: string[];
  emails: string[];
  complianceStatus: string;
}

interface EacAgencyDirectory {
  sourceUrl: string;
  retrievedAt: string;
  agencies: EacAgencyOption[];
}

const directory = directoryData as EacAgencyDirectory;

export const eacAgencySourceUrl = directory.sourceUrl;
export const eacAgencyRetrievedAt = directory.retrievedAt;

export function getEacAgency(id: string): EacAgencyOption | null {
  return directory.agencies.find((agency) => agency.id === id) ?? null;
}

export function searchEacAgencies(query: string): EacAgencyOption[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return directory.agencies
    .filter((agency) => `${agency.name} ${agency.location}`.toLowerCase().includes(term))
    .slice(0, 20);
}
