// Food-only crops from the supplied 1312 × 1199 search design board.
// Crops exclude the baked-in badges, hearts and all other interface text.
export const searchPhotos = {
  hero: [602, 62, 165, 151],
  creamy: [50, 345, 270, 91],
  rice: [357, 345, 270, 91],
  thighs: [660, 345, 266, 91],
  mushrooms: [47, 804, 198, 56],
  kavarma: [273, 804, 197, 56],
  teriyaki: [499, 804, 196, 56],
  soup: [724, 804, 196, 56],
  lemon: [47, 990, 198, 54],
  airFryer: [273, 990, 197, 54],
  vegetables: [499, 990, 196, 54],
  skewers: [724, 990, 196, 54],
} as const;

export type SearchPhotoName = keyof typeof searchPhotos;
