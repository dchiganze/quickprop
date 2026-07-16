---
name: QuickProp Office CRM
description: Web CRM (artifacts/office + artifacts/api-server) — key integration lessons.
---

# QuickProp Office

- Demo auth: plain `qp_uid` httpOnly cookie; any seeded email + "demo1234". `requireAuth` middleware guards all business routes in `routes/index.ts`; `requireRole("principal","admin")` guards user/branch mutations and audit-log.
- Zod response schemas expect ISO string dates, but Drizzle returns `Date` objects — every `.parse(...)` of DB rows must go through `jsonify()` (JSON round-trip) in helpers. **How to apply:** any new route returning DB rows.
- Wouter gotcha: a custom `ProtectedRoute` that renders `<Component />` directly never receives URL params; wrap in `<Route path>{(params) => <Component params={params}/>}</Route>`.
- Seed script: no tsx in this monorepo; bundle `src/seed.ts` with esbuild (`external: ['pino','pino-pretty','pino-http']`, createRequire banner) then run `node dist/seed.mjs`. `packages:'external'` fails on workspace dir-import ESM.
- Orval hooks: passing custom `query` options (e.g. `enabled`) requires also supplying `queryKey` via the generated `get*QueryKey()` helper.
