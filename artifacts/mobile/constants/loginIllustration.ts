import { welcomeIllustrationXml as generatedWelcomeIllustrationXml } from './welcomeIllustration';

// The generated XML may lag the source SVG, so strip the face-discoloring stroke at render time too.
export const welcomeIllustrationXml = generatedWelcomeIllustrationXml.replace(
  /<path d="m58\.79 19\.02[^"]*" fill="#A698B8" fill-opacity=".58"\/>/,
  '',
).replace(
  /<path d="m60\.07 24\.55[^"]*" fill="#D2E7F2" stroke="#0D244E" stroke-width=".2865"\/>/,
  '',
);
