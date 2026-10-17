// Food-only regions from the supplied 1312 × 1199 design board.
// SVG viewports crop the unchanged local asset and preserve its aspect ratio.
// All UI is rendered separately as accessible HTML.
export const referencePhotos = {
  hero: [697, 174, 260, 150],
  mobileHero: [991, 164, 298, 85],
  soup: [46, 455, 128, 87],
  main: [194, 454, 132, 87],
  salad: [344, 454, 131, 87],
  dessert: [495, 453, 130, 88],
  quick: [645, 454, 130, 87],
  bulgarian: [796, 454, 129, 87],
  chicken: [49, 714, 272, 96],
  pasta: [349, 714, 272, 96],
  moussaka: [649, 714, 271, 96],
  seasonalSoup: [52, 1148, 162, 50],
  seasonalSalad: [239, 1148, 158, 50],
  seasonalMain: [425, 1148, 158, 50],
  seasonalDessert: [792, 1148, 154, 50],
  garnish: [796, 957, 130, 100],
  avatar: [885, 13, 31, 31],
} as const;

export type ReferencePhotoName = keyof typeof referencePhotos;
