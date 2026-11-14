import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyMatchesAlert } from './alert-matching.ts';

const property = {
  type: 'sale',
  listingType: 'sale',
  propertyType: 'apartment',
  city: 'Harare',
  suburb: 'Avondale',
  bedrooms: 2,
  price: 95000,
  currency: 'USD',
  features: ['Solar'],
};

test('matches alerts with a listing type, property category, city, and suburb', () => {
  assert.equal(propertyMatchesAlert(property, {
    type: 'sale',
    propertyTypes: ['apartment'],
    city: 'Harare',
    suburb: 'Avondale',
    features: [],
  }), true);
});

test('rejects an alert when the listing does not match its city or property category', () => {
  assert.equal(propertyMatchesAlert(property, { type: 'sale', city: 'Bulawayo', features: [] }), false);
  assert.equal(propertyMatchesAlert(property, { type: 'sale', propertyTypes: ['townhouse'], features: [] }), false);
});

test('continues matching legacy category-only alerts', () => {
  assert.equal(propertyMatchesAlert(property, { type: 'apartment', features: [] }), true);
});
