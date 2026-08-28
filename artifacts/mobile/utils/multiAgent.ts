import {
  addPropertyAgencyRelationship,
  checkPropertyDuplicate,
  type AgencyRelationshipInput,
  type DuplicateCheckInput,
} from '@workspace/api-client-react';

export async function findPropertyDuplicates(input: DuplicateCheckInput) {
  return checkPropertyDuplicate(input);
}

export async function addMyAgencyToProperty(propertyId: number, input: AgencyRelationshipInput) {
  return addPropertyAgencyRelationship(propertyId, input);
}