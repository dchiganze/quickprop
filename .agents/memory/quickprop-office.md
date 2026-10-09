---
name: QuickProp Office CRM
description: Web CRM (artifacts/office + artifacts/api-server) — key integration lessons.
---

# QuickProp Office

- Browser sessions use HMAC-signed tokens in the httpOnly `qp_uid` cookie; raw numeric cookies are rejected. **Why:** the old user-ID cookie could be forged, and the user approved requiring web users to sign in again after release. **How to apply:** keep browser identity signed and account for reauthentication when changing session validation.
- API server live checks: restart the managed API workflow after route changes because its dev command bundles before starting and does not hot-reload the running bundle. **Why:** otherwise endpoint probes can exercise stale authorization and response shapes. **How to apply:** restart before testing backend changes.
- Zod response schemas expect ISO string dates, but Drizzle returns `Date` objects — every `.parse(...)` of DB rows must go through `jsonify()` (JSON round-trip) in helpers. **How to apply:** any new route returning DB rows.
- Wouter gotcha: a custom `ProtectedRoute` that renders `<Component />` directly never receives URL params; wrap in `<Route path>{(params) => <Component params={params}/>}</Route>`.
- Seed script: no tsx in this monorepo; bundle `src/seed.ts` with esbuild (`external: ['pino','pino-pretty','pino-http']`, createRequire banner) then run `node dist/seed.mjs`. `packages:'external'` fails on workspace dir-import ESM.
- Orval hooks: passing custom `query` options (e.g. `enabled`) requires also supplying `queryKey` via the generated `get*QueryKey()` helper.
- Selling status is stored in `availabilityStatus`, while public visibility remains in `status`; sold and withdrawn records leave the active marketplace portfolio and sold metadata is shown in agent selling history. **Why:** visibility and sales lifecycle need to change independently. **How to apply:** use `availabilityStatus` for Office selling-status mutations and public-history queries.
