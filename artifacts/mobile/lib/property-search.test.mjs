import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListingSearch, propertyMatchesQuery } from './property-search.ts';

const highlandsHome = {
  address: 'Enterprise Road',
  suburb: 'Highlands',
  referenceNumber: 'QP-1001',
  type: 'sale',
  propertyType: 'house',
  listingType: 'sale',
  status: 'published',
  currency: 'USD',
  description: 'Renovated three-bedroom family home',
  price: 275000,
  bedrooms: 3,
  bathrooms: 2,
  garages: 2,
  features: ['Solar panels', 'Borehole'],
  seller: { name: 'Agency Seller', mandateType: 'open' },
};

test('parses combined bedroom, suburb, and amenity intent', () => {
  assert.deepEqual(parseListingSearch('3 bedroom in Highlands with solar'), {
    bedrooms: 3,
    suburb: 'Highlands',
    amenities: ['solar'],
    keywords: [],
  });
});

test('requires each structured criterion to match the same listing', () => {
  const query = '3 bedroom in Highlands with solar';
  assert.equal(propertyMatchesQuery(highlandsHome, query), true);
  assert.equal(propertyMatchesQuery({ ...highlandsHome, bedrooms: 4 }, query), false);
  assert.equal(propertyMatchesQuery({ ...highlandsHome, suburb: 'Avondale' }, query), false);
  assert.equal(propertyMatchesQuery({ ...highlandsHome, features: ['Borehole'] }, query), false);
});

test('retains simple bedroom shortcuts and combines them with other words', () => {
  assert.equal(propertyMatchesQuery(highlandsHome, '3 bed'), true);
  assert.equal(propertyMatchesQuery({ ...highlandsHome, bedrooms: 2 }, '3 bed'), false);
  assert.equal(propertyMatchesQuery(highlandsHome, '3 bed Highlands solar'), true);
});
