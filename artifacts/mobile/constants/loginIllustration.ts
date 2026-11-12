import { welcomeIllustrationXml as generatedWelcomeIllustrationXml } from './welcomeIllustration';

// The generated XML may lag the source SVG, so strip the face-discoloring stroke at render time too.
export const welcomeIllustrationXml = generatedWelcomeIllustrationXml.replace(
  /<path d="m58\.79 19\.02[^"]*" fill="#A698B8" fill-opacity=".58"\/>/,
  '',
).replace(
  /(fill="#B35B33" stroke="#0D244E" stroke-width=".2173"\/>)/,
  '$1\n  <path d="M60.2 13.7c1.42-.52 3.15.05 4.2 1.3.98 1.18 1.19 2.72.83 4.25-.39 1.7-1.3 3.04-2.47 4.22-.72.72-1.35 1.07-1.95 1.08.53-1.03.85-2.02.37-2.94-.88-1.68-1.23-3.56-.98-5.41.13-.96.15-1.75 0-2.5z" fill="#B35B33"/>',
);
