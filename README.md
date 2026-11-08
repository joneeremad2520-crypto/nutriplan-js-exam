# NutriPlan

NutriPlan is a browser-based meal planner with recipe browsing, product lookup,
and a daily food log.

## Run locally

Serve this folder with a static web server (for example, VS Code Live Server)
and open its `index.html`. The app uses ES modules and public APIs, so it should
not be opened directly with `file://`.

## Features

- Browse 25 recipes, search by name, and filter by category or cuisine.
- Open recipe details for ingredients, preparation steps, a video when
  available, and estimated nutrition facts.
- Search products by brand name or look them up by barcode. Product results
  include nutrition facts and Nutri-Score filters.
- Add meals and products to the daily food log, review nutrition goal progress,
  remove individual entries, clear a day, and view earlier dates.
- Navigate between `/home`, `/products`, `/foodlog`, and `/meal/{id}` routes.

## Data and storage

- Recipes and cuisine/category filters come from
  [TheMealDB](https://www.themealdb.com/api.php).
- Product information comes from
  [Open Food Facts](https://world.openfoodfacts.org/). Name searches use its
  brand index; barcode lookups use the product API.
- Food log entries are stored in browser `localStorage` under
  `nutriplan-food-log`; no food-log endpoint is used.
- TheMealDB does not provide verified nutrition facts, so meal nutrition shown
  in this app is an estimate. Product nutrition is taken from Open Food Facts
  and is reported per 100 g where available.
