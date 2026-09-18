import { Property } from '@/types';

/**
 * Public QuickProp site used when the recipient does not have QuickProp Agent.
 * EXPO_PUBLIC_DOMAIN is injected per deployment; the production domain is the
 * same one configured in the mobile app's support and marketing URLs.
 */
const PRODUCTION_DOMAIN = 'www.quickprop.melios.co.zw';
const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const configuredHost = configuredDomain?.split('/')[0].toLowerCase();
const isDevelopmentDomain = Boolean(
  configuredHost && (
    configuredHost === 'localhost' ||
    configuredHost === '127.0.0.1' ||
    configuredHost === '0.0.0.0' ||
    configuredHost.endsWith('.replit.dev')
  ),
);
export const QUICKPROP_WEB_URL = `https://${configuredHost && !isDevelopmentDomain ? configuredDomain : PRODUCTION_DOMAIN}`;
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
    previewUrl: `${QUICKPROP_WEB_URL}/api/share/properties/${encodeURIComponent(property.referenceNumber)}`,
  };
}

export function catalogueShareLinks(agentId?: string) {
  const cataloguePath = agentId ? `/agents/${encodeURIComponent(agentId)}` : '';
  const appQuery = query({ catalogue: agentId ? 'agent' : 'company', agentId });
  return {
    appUrl: `${QUICKPROP_AGENT_SCHEME}://invite?${appQuery}`,
    webUrl: `${QUICKPROP_WEB_URL}${cataloguePath}`,
    previewUrl: `${QUICKPROP_WEB_URL}/api/share/catalogues/${agentId ? `agents/${encodeURIComponent(agentId)}` : 'company'}`,
  };
}

export function inviteShareLink(inviteToken: string) {
  const inviteQuery = query({ invite: inviteToken });
  return {
    appUrl: `${QUICKPROP_AGENT_SCHEME}://invite?${inviteQuery}`,
    webUrl: `${QUICKPROP_WEB_URL}/invite?${inviteQuery}`,
  };
}