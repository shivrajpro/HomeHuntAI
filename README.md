# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Seed data (HomeHuntAI listings)

The app ships with `src/features/properties/data/listings.json` — **2,000 fictional
property listings**, 500 each across four Indian markets:

- **Bangalore, Karnataka** — Electronic City, Whitefield, Sarjapur Road, HSR Layout, Koramangala, Indiranagar, and more.
- **Hyderabad, Telangana** — Gachibowli, Kondapur, Madhapur, Financial District, Kokapet, Banjara/Jubilee Hills, and more.
- **Delhi NCR** — Noida (Sec 150/137/76), Greater Noida West, Dwarka, Gurugram (Golf Course Rd, Sohna Rd), Ghaziabad and Faridabad.
- **Pune, Maharashtra** — Hinjewadi, Wakad, Baner, Balewadi, Kharadi, Hadapsar, Viman Nagar, Kalyani Nagar, Koregaon Park, Aundh, and more.

Every listing is **invented** — builders, projects, addresses, contacts and prices are
fictional. Only the localities and nearby landmarks (metros, tech parks, malls,
hospitals, schools) are real places. Pricing, areas, RERA status, amenities and the
per-locality AI scores (`walkability`, `familyScore`, `investmentScore`, …) are tuned
to reflect real market bands. The shape is defined and validated by the Zod schema in
`src/features/properties/types.ts`.

Distributions match a realistic portal: ~65% Apartments, 10% Villas / Independent
Houses / Builder Floors each, 5% Plots; 75% Buy / 25% Rent; BHK spread 10/40/35/12/3.

### Regenerating the seed

The generator is deterministic (seeded PRNG), so re-running produces an identical file:

```bash
npm run seed
```

Edit locality bands, landmarks or distributions in
[`scripts/generate-listings.mjs`](scripts/generate-listings.mjs).
