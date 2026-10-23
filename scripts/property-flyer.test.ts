import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMainListingPhoto, getPrimaryListingPhoto } from '../artifacts/mobile/utils/listingPhoto';
import {
  buildDefaultFlyerSettings, defaultHeadline, FLYER_TEMPLATES, flyerFeatures,
  flyerLocation, flyerPrice, mergeFlyerSettings, safeColor,
} from '../artifacts/mobile/utils/propertyFlyer';
import { buildPropertyFlyerCaption } from '../artifacts/mobile/utils/shareContent';
import type { Property, User } from '../artifacts/mobile/types';

const property = {
  id: '36', referenceNumber: 'TEST', title: 'Family home', type: 'sale',
  photos: ['front.jpg', 'pool.jpg', 'kitchen.jpg'], address: 'Private street',
  suburb: 'Avondale', city: 'Harare', price: 180000, currency: 'USD', status: 'published',
  features: ['Solar backup', 'Borehole'], agentId: '2535',
} as Property;
const user = { id: '2535', name: 'Agent Example', agency: 'Profile agency', phone: '+263000000000' } as User;

test('main photo selection moves one photo to the front without losing or mutating any photos', () => {
  const photos = [...property.photos];
  assert.deepEqual(selectMainListingPhoto(photos, 2), ['kitchen.jpg', 'front.jpg', 'pool.jpg']);
  assert.deepEqual(photos, property.photos);
  for (const index of [-1, 99, 1.5, NaN]) assert.deepEqual(selectMainListingPhoto(photos, index), photos);
  const selected = { ...property, photos: selectMainListingPhoto(photos, 1) };
  assert.equal(getPrimaryListingPhoto(selected), 'pool.jpg');
});

test('all three flyer templates exist and agency branding supplies defaults, with agent contact', () => {
  assert.deepEqual(FLYER_TEMPLATES.map(t => t.id), ['editorial', 'showcase', 'minimal']);
  const settings = buildDefaultFlyerSettings(property, user, {
    agencyName: 'Actual agency', primaryColor: '#123456', logoUrl: 'https://example.com/logo.png', tagline: 'Agency tagline',
  });
  assert.equal(settings.agencyName, 'Actual agency');
  assert.equal(settings.primaryColor, '#123456');
  assert.equal(settings.contactName, user.name);
  assert.equal(settings.contactPhone, user.phone);
  assert.equal(settings.headline, 'Family home');
  assert.equal(settings.logoUrl, 'https://example.com/logo.png');
});

test('customisation preserves valid choices, rejects unknown templates and keeps missing defaults', () => {
  const defaults = buildDefaultFlyerSettings(property, user);
  const custom = mergeFlyerSettings(defaults, { template: 'showcase', agencyName: 'My brand', primaryColor: '#112233' });
  assert.equal(custom.template, 'showcase');
  assert.equal(custom.agencyName, 'My brand');
  assert.equal(custom.contactName, defaults.contactName);
  assert.equal(mergeFlyerSettings(defaults, { template: 'unknown' }).template, 'editorial');
  assert.equal(safeColor('not-a-colour'), '#1A3C6E');
});

test('flyers honour address privacy by default and contain only recorded features', () => {
  assert.equal(flyerLocation(property), 'Avondale, Harare');
  assert.equal(flyerLocation({ ...property, showAddress: false }), 'Avondale, Harare');
  assert.equal(flyerLocation({ ...property, showAddress: true }), 'Private street, Avondale, Harare');
  assert.deepEqual(flyerFeatures(property), ['Solar backup', 'Borehole']);
  assert.deepEqual(flyerFeatures({ ...property, features: [] }), []);
});

test('commercial rentals receive rental headline and monthly price independently of category', () => {
  const rental = { ...property, title: undefined, type: 'commercial', listingType: 'rent', propertyType: 'commercial' } as Property;
  assert.match(defaultHeadline(rental), /To Rent/);
  assert.match(flyerPrice(rental), /\/mo$/);
});

test('WhatsApp flyer caption uses the exact requested words and the sharing agent catalogue', () => {
  const caption = buildPropertyFlyerCaption(user.id);
  assert.equal(caption, 'For my full catalogue on QuickProp click this link\nhttps://www.quickprop.melios.co.zw/agents/2535');
  assert.equal(caption.includes('/properties/'), false);
});

test('logo palette supplies flyer accents, with manual custom colours preserved', () => {
  const base = buildDefaultFlyerSettings(property, user, {
    primaryColor: '#10B981', logoColors: ['#343CCF', '#6E72D8'], logoUrl: '/api/storage/objects/uploads/1/logo.png',
  });
  assert.equal(base.primaryColor, '#343CCF');
  assert.deepEqual(base.logoColors, ['#343CCF', '#6E72D8']);
  const inherited = mergeFlyerSettings(base, { primaryColor: '#10B981', logoUrl: '' });
  assert.equal(inherited.primaryColor, '#343CCF');
  assert.equal(inherited.logoUrl, base.logoUrl);
  const manual = mergeFlyerSettings(base, { primaryColor: '#FF8800', accentSource: 'custom' });
  assert.equal(manual.primaryColor, '#FF8800');
  const automatic = mergeFlyerSettings(base, { primaryColor: '#FF8800', accentSource: 'logo' });
  assert.equal(automatic.primaryColor, '#343CCF');
});

test('agency-logo inheritance does not override custom or deliberately removed logos', () => {
  const base = buildDefaultFlyerSettings(property, user, { logoUrl: 'https://example.com/agency-logo.png' });
  assert.equal(mergeFlyerSettings(base, { logoUrl: '', logoSource: 'none' }).logoUrl, '');
  assert.equal(mergeFlyerSettings(base, { logoUrl: 'file:///my-logo.png', logoSource: 'custom' }).logoUrl, 'file:///my-logo.png');
  assert.equal(mergeFlyerSettings(base, { logoUrl: 'file:///old-logo.png', logoSource: 'agency' }).logoUrl, base.logoUrl);
});
