import { normalize } from "./quality-types.ts";
/** Deliberately bounded Bulgarian lexicon. Unknown foods are not proof of absence. */
export const foods: Record<string, RegExp> = {
  poultry: /пилеш|пиле|пуеш|пуйк|патеш|патиц|гъше/u,
  ground: /кайма|смляно\s+месо|мляно\s+месо/u,
  meat: /свин|телеш|говеж|агнеш|месо|бекон|шунка|колбас|салам/u,
  fish: /риба|рибен|сьомг|пъстърв|треска|скумри|сардин|тон(?:а|ът)?(?:\s|$)/u,
  shellfish: /скарид|мид[аи]|стрид|омар|рак(?:ово|\s|$)|калмар/u,
  dairy: /мляко|сирен|кашкавал|сметан|йогурт|кисело\s+мляко|краве\s+масло|^масло$|маскарпоне|пармезан|извара/u,
  eggs: /яйц|яйце|жълтъ|белтъ/u,
  peanuts: /фъст[ъу][кч]|арахис|peanut/u,
  gluten: /пшен|булгур|ечемик|ръж|грис|кус.?кус|сейтан/u,
  honey: /(?:^|\s)мед(?:ът|\s|$)/u,
  tomatoPaste: /доматен[оа]\s+(?:пюре|паста|концентрат)/u,
  tomatoes: /домат/u,
  rice: /ориз/u,
  potatoes: /картоф/u,
  mushrooms: /гъб|печур|манатар/u,
  carrot: /морков/u,
  onion: /лук/u,
  salt: /(?:^|\s)сол(?:та|\s|$)/u,
};
export function foodGroups(value: string): string[] {
  const name = normalize(value), plant = /растител|веган|кокос|соев|бадем|овес|оризов|безмлеч/u.test(name);
  return Object.entries(foods).filter(([key, regex]) => regex.test(name) && !(["poultry", "ground", "meat", "fish", "shellfish"].includes(key) && /подправка за|вкус на/u.test(name)) && !(key === "tomatoes" && foods.tomatoPaste.test(name)) && !(key === "dairy" && plant)).map(([key]) => key);
}
export function ingredientKey(value: string): string { const groups = foodGroups(value).filter((g) => !["meat", "gluten"].includes(g)); return groups.length === 1 ? groups[0] : normalize(value); }
export const seasoning = (value: string) => /сол|пипер|подправ|магданоз|копър/u.test(normalize(value));
