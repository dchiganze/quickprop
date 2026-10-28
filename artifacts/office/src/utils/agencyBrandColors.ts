const FALLBACK_ACCENT = '#1A3C6E';
const QUICKPROP_DEFAULT_GREEN = '#10B981';

export interface AgencyBrandColorsInput {
  primaryColor?: string | null;
  logoColors?: string[] | null;
}

export function getAgencyBrandColors(agency?: AgencyBrandColorsInput | null) {
  const logoColors = (agency?.logoColors ?? [])
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    .map((color) => color.toUpperCase());
  const configuredColor = agency?.primaryColor && /^#[0-9a-f]{6}$/i.test(agency.primaryColor)
    ? agency.primaryColor.toUpperCase()
    : undefined;
  const primaryColor = logoColors[0]
    ?? (configuredColor && configuredColor !== QUICKPROP_DEFAULT_GREEN ? configuredColor : FALLBACK_ACCENT);
  return { primaryColor, secondaryColor: logoColors[1] ?? primaryColor };
}
