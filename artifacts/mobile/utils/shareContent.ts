import { Property } from '@/types';
import { catalogueShareLinks, propertyShareLinks } from './shareLinks';

export function buildPropertyFlyerCaption(agentId?: string): string {
  return `For my full catalogue on QuickProp click this link\n${catalogueShareLinks(agentId).webUrl}`;
}

export type CatalogueMode = 'agent' | 'company';

export function formatSharePrice(property: Pick<Property, 'price' | 'currency' | 'type'>): string {
  const price = property.price >= 1_000_000
    ? `${property.currency} ${(property.price / 1_000_000).toFixed(2)}M`
    : `${property.currency} ${property.price.toLocaleString()}`;
  return property.type === 'rent' ? `${price}/mo` : price;
}

export function propertyShareTitle(property: Pick<Property, 'type' | 'suburb'>): string {
  const type = property.type.charAt(0).toUpperCase() + property.type.slice(1);
  return `${type} — ${property.suburb}`;
}

export function buildPropertyShareMessage(property: Property, agentName?: string): string {
  const lines = [
    `🏠 *${propertyShareTitle(property)}*`,
    property.showAddress && property.address
      ? `📍 ${property.address}, ${property.suburb}`
      : `📍 ${property.suburb}`,
    '',
    `💰 *${formatSharePrice(property)}*${property.negotiable ? ' _(Negotiable)_' : ''}`,
    '',
  ];

  const stats = [
    property.bedrooms !== undefined && property.bedrooms > 0 && `🛏 ${property.bedrooms} bed`,
    property.bathrooms !== undefined && property.bathrooms > 0 && `🚿 ${property.bathrooms} bath`,
    property.garages !== undefined && property.garages > 0 && `🚗 ${property.garages} garage`,
  ].filter(Boolean) as string[];
  if (stats.length) lines.push(stats.join('  |  '));

  const sizes = [
    property.landSize !== undefined && property.landSize > 0 && `Land: ${property.landSize.toLocaleString()}m²`,
    property.floorArea !== undefined && property.floorArea > 0 && `Floor: ${property.floorArea.toLocaleString()}m²`,
  ].filter(Boolean) as string[];
  if (sizes.length) lines.push(`📐 ${sizes.join('  |  ')}`);

  if (property.features.length) {
    lines.push('');
    lines.push(`✅ *Features:* ${property.features.slice(0, 8).join(', ')}`);
  }
  if (property.description.trim()) {
    const description = property.description.replace(/\s+/g, ' ').trim();
    lines.push('');
    lines.push(`📝 ${description.slice(0, 220)}${description.length > 220 ? '…' : ''}`);
  }

  const links = propertyShareLinks(property);
  lines.push('');
  lines.push(`📋 Ref: *${property.referenceNumber}*`);
  if (agentName) lines.push(`Agent: ${agentName}`);
  lines.push(`See full details on QuickProp: ${links.webUrl}`);
  return lines.join('\n');
}

export function buildPropertySocialShareMessage(property: Property, agentName?: string): string {
  const typeLabel = property.type === 'sale'
    ? 'For Sale'
    : property.type === 'rent'
      ? 'To Rent'
      : property.type.charAt(0).toUpperCase() + property.type.slice(1);
  const title = property.title?.trim() || `${typeLabel} — ${property.suburb}`;
  const location = property.showAddress && property.address
    ? `${property.address}, ${property.suburb}`
    : [property.suburb, property.city].filter(Boolean).join(', ');
  const lines = [`${title}`, location ? `📍 ${location}` : '', `💰 ${formatSharePrice(property)}${property.negotiable ? ' (Negotiable)' : ''}`]
    .filter(Boolean);

  const stats = [
    property.bedrooms ? `${property.bedrooms} bed` : '',
    property.bathrooms ? `${property.bathrooms} bath` : '',
    property.garages ? `${property.garages} garage` : '',
  ].filter(Boolean);
  if (stats.length) lines.push(stats.join('  |  '));

  const sizes = [
    property.landSize ? `Land: ${property.landSize.toLocaleString()}m²` : '',
    property.floorArea ? `Floor: ${property.floorArea.toLocaleString()}m²` : '',
  ].filter(Boolean);
  if (sizes.length) lines.push(`📐 ${sizes.join('  |  ')}`);

  if (property.description.trim()) {
    lines.push('', property.description.replace(/\s+/g, ' ').trim());
  }
  if (property.features.length) {
    lines.push('', 'Features:', ...property.features.slice(0, 8).map(feature => `• ${feature}`));
  }

  const links = propertyShareLinks(property);
  lines.push('', `Ref: ${property.referenceNumber}`);
  if (agentName) lines.push(`Agent: ${agentName}`);
  lines.push(`View full listing: ${links.webUrl}`);
  return lines.join('\n');
}

export function buildCatalogueShareMessage(
  properties: Property[],
  mode: CatalogueMode,
  agentName: string | undefined,
  agentId: string | undefined,
): string {
  const links = catalogueShareLinks(mode === 'agent' ? agentId : undefined);
  const lines = [
    'QuickProp — Property Brochure',
    'Your trusted Harare estate agency',
  ];
  if (mode === 'agent' && agentName) lines.push(`Agent: ${agentName}`);
  lines.push('');

  const forSale = properties.filter(property => property.type === 'sale');
  const forRent = properties.filter(property => property.type === 'rent');

  if (forSale.length > 0) {
    lines.push(`For Sale (${forSale.length} properties):`);
    forSale.slice(0, 8).forEach(property => {
      const beds = property.bedrooms ? `${property.bedrooms}-bed ` : '';
      lines.push(`• ${beds}Property in ${property.suburb} — ${formatSharePrice(property)}`);
      const description = property.description.replace(/\s+/g, ' ').trim();
      if (description) lines.push(`  ${description.slice(0, 90)}${description.length > 90 ? '…' : ''}`);
    });
    lines.push('');
  }

  if (forRent.length > 0) {
    lines.push(`To Rent (${forRent.length} properties):`);
    forRent.slice(0, 5).forEach(property => {
      const beds = property.bedrooms ? `${property.bedrooms}-bed ` : '';
      lines.push(`• ${beds}Property in ${property.suburb} — ${formatSharePrice(property)}`);
      const description = property.description.replace(/\s+/g, ' ').trim();
      if (description) lines.push(`  ${description.slice(0, 90)}${description.length > 90 ? '…' : ''}`);
    });
    lines.push('');
  }

  lines.push(`See full details on QuickProp: ${links.webUrl}`);
  lines.push('Reply to enquire about any property.');
  return lines.join('\n');
}