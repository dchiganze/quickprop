import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getContactDisplayValues } from './contact-display.ts';

test('shows a misplaced alphabetic surname with the contact name, not as a phone', () => {
  assert.deepEqual(getContactDisplayValues('Farai', 'Gwanzura'), {
    name: 'Farai Gwanzura',
    phone: '',
  });
});

test('keeps a full name and a valid phone number separate', () => {
  assert.deepEqual(getContactDisplayValues('Farai Gwanzura', '+263 77 123 4567'), {
    name: 'Farai Gwanzura',
    phone: '+263 77 123 4567',
  });
});

test('does not treat placeholders or short numeric values as surnames', () => {
  assert.deepEqual(getContactDisplayValues('Farai', 'Not provided'), {
    name: 'Farai',
    phone: '',
  });
  assert.deepEqual(getContactDisplayValues('Farai', '1234'), {
    name: 'Farai',
    phone: '',
  });
});
