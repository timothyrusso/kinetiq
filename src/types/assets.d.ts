/**
 * Font files imported as modules.
 *
 * Metro resolves these to an asset id at build time; TypeScript needs telling the import is
 * legal and what it yields. Skia's `useFont` accepts the number Metro hands back, which is how
 * the charts get Inter for their axis labels without loading a second copy of the family.
 */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}

declare module '*.otf' {
  const asset: number;
  export default asset;
}
