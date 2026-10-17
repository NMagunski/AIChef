# Food safety rules — Task 9

Reviewed 2026-10-17. These are bounded home-cooking checks, not professional
certification, a HACCP system or a guarantee of safe food. They do not model
pasteurization, sous vide, canning, fermentation, cold-chain history or vulnerable
people's additional requirements. No paid provider requests were used.

## Authoritative sources

- FDA, [Safe Food Handling](https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling).
  Reviewed the page itself: clean/separate/cook/chill guidance, raw-food separation,
  thermometer use, refrigeration, thawing and temperature table.
- Federal FoodSafety.gov, [Cook to a Safe Minimum Internal Temperature](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures).
  Reviewed the page itself (last-reviewed date shown: November 21, 2024).
  Its rounded Celsius table is the source for the constants below.
- USDA FSIS, [Safe Minimum Internal Temperature Chart](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart)
  and [Food Thermometers](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/food-thermometers).
  Existing project references retained. Direct retrieval returned HTTP 403 during
  Task 9, so the rules were checked against the accessible federal pages above.

## Implemented scope

| Product | Minimum internal target used | Treatment |
| --- | --- | --- |
| Poultry, including ground poultry | 74°C / 165°F | Explicit lower internal target is an error |
| Ground non-poultry meat | 71°C / 160°F | Explicit lower internal target is an error |
| Whole beef, pork, lamb cuts | 63°C / 145°F plus 3 minutes rest | Lower target errors; missing rest warns |
| Fin fish | 63°C / 145°F | Lower explicit internal target errors |
| Egg dishes | 71°C / 160°F | Lower explicit internal target errors |
| Shellfish | Species-specific guidance | Informational reminder; no invented universal target |

Only explicitly identified **internal** Celsius/Fahrenheit targets are compared.
Structured `step.temperatureC` and ordinary oven settings are equipment metadata,
never proof of internal doneness. Celsius and Fahrenheit targets are compared directly against their respective
federal table entries, without introducing a tolerance below the chosen minimum. Multiple unclear food references warn rather than
asserting certainty; poultry/ground specificity takes precedence over generic meat.
Whole eggs and egg dishes differ: this initial text lexicon cannot always resolve
that distinction, so it does not evaluate soft-egg/pasteurization methods reliably.

Missing thermometer advice produces a warning, not rejection. Existing normalized
AI recipes already include general thermometer guidance; this remains a reminder,
not evidence that a measurement was taken. Visual-doneness-only claims warn.
Explicit serving of raw/undercooked poultry, certain dirty-vessel reuse instructions,
and room-temperature thawing instructions are errors. Negative instructions such
as “Не сервирай сурово пилешко” are not treated as positive recommendations.

For recognized perishables (meat, seafood, eggs, dairy and cooked-rice context),
explicit recommendations to leave food at room temperature longer than two hours
are errors; explicit above-32°C hot ambient context uses one hour. Overnight
storage is included. Unspecified storage durations do not prove safety. FDA also
recommends prompt refrigeration and separate clean equipment for raw foods.

## Limitations and review

Bulgarian phrase recognition is deliberately bounded. Negation, unusual ingredient
names, implicit temperatures, complex conditionals, multiple targets and cross-step
context can escape recognition or need human review. Do not use a passing result
or a data-quality score to certify food, allergens, dietary suitability or storage.
No third-party instruction is corrected automatically. Rejected web content stays
metadata-only, with the original source link and no internal cooking instructions.
Before production, obtain culinary/food-safety review, expand evaluated Bulgarian
examples, check current source guidance and add regression tests for each new rule.
