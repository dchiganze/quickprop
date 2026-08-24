import { Property } from '@/types';

/**
 * Public QuickProp site used when the recipient does not have QuickProp Agent.
 * EXPO_PUBLIC_DOMAIN is injected per deployment; the production domain is the
 * same one configured in the mobile app's support and marketing URLs.
 */
const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
export const QUICKPROP_WEB_URL = `https://${configuredDomain || 'quickprop.melios.co.zw'}`;
export const QUICKPROP_AGENT_SCHEME = 'quickpropagent';

function query(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`)
    .join('&');
}

export function propertyShareLinks(property: Pick<Property, 'id' | 'referenceNumber'>) {
  const propertyQuery = query({ propertyId: property.id, ref: property.referenceNumber });
  return {
    appUrl: `${QUICKPROP_AGENT_SCHEME}://invite?${propertyQuery}`,
    // References remain stable even when a queued offline listing is replaced
    // with its server ID. The public API accepts both IDs and references.
    webUrl: `${QUICKPROP_WEB_URL}/properties/${encodeURIComponent(property.referenceNumber)}`,
  };
}

export function catalogueShareLinks(agentId?: string) {
  const cataloguePath = agentId ? `/agents/${encodeURIComponent(agentId)}` : '';
  const appQuery = query({ catalogue: agentId ? 'agent' : 'company', agentId });
  return {
    appUrl: `${QUICKPROP_AGENT_SCHEME}://invite?${appQuery}`,
    webUrl: `${QUICKPROP_WEB_URL}${cataloguePath}`,
  };
}

export function inviteShareLink(inviteToken: string) {
  const inviteQuery = query({ invite: inviteToken });
  return {
    appUrl: `${QUICKPROP_AGENT_SCHEME}://invite?${inviteQuery}`,
    webUrl: `${QUICKPROP_WEB_URL}/invite?${inviteQuery}`,
  };
}