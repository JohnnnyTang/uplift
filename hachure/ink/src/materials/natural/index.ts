/**
 * Natural, illustrative materials: palette, lithology patterns and cel-shaded node materials. The palette
 * and patterns have no three.js dependency; the materials do.
 */
export { NATURAL_TOKENS, type NaturalToken } from "./palette";
export {
  type LithologyLook,
  type LithologyPatternKind,
  type PatternMark,
  type PatternPainter,
  type TileOptions,
  PROVISIONAL_LITHOLOGIES,
  lithologyById,
  lithologyPatternSvg,
  mixHex,
  paintLithologyTile,
  patternMarks,
} from "./lithology";
export {
  type NaturalUniforms,
  type WallMaterialOptions,
  applyRockLook,
  createGroundMaterial,
  createIceMaterial,
  createIceSectionMaterial,
  createLithologyTexture,
  createNaturalUniforms,
  createTreeMaterial,
  createWallMaterial,
  createWaterMaterial,
} from "./materials";
