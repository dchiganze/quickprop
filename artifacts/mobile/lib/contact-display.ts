const LEGACY_PHONE_PLACEHOLDERS = new Set([
  'na',
  'n/a',
  'none',
  'no phone',
  'not provided',
  'unknown',
]);

export function getContactDisplayValues(nameValue: string, phoneValue?: string | null) {
  const name = nameValue.trim();
  const storedPhone = phoneValue?.trim() ?? '';
  const phoneDigitCount = storedPhone.replace(/\D/g, '').length;
  const nameParts = name.split(/\s+/).filter(Boolean);
  const phoneLower = storedPhone.toLowerCase();
  const isLegacySurname = phoneDigitCount < 7
    && nameParts.length === 1
    && storedPhone.length <= 40
    && !LEGACY_PHONE_PLACEHOLDERS.has(phoneLower)
    && /^[\p{L}][\p{L}'’\-]*$/u.test(storedPhone)
    && phoneLower !== name.toLowerCase();

  return {
    name: isLegacySurname ? `${name} ${storedPhone}` : name,
    phone: phoneDigitCount >= 7 ? storedPhone : '',
  };
}
