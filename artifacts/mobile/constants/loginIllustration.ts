import { welcomeIllustrationXml as generatedWelcomeIllustrationXml } from './welcomeIllustration';

// The generated XML may lag the source SVG, so strip the face-discoloring stroke at render time too.
export const welcomeIllustrationXml = generatedWelcomeIllustrationXml.replace(
  /<path d="m58\.79 19\.02[^"]*" fill="#A698B8" fill-opacity=".58"\/>/,
  '',
);
