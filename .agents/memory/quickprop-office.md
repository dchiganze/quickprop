---
name: QuickProp Office CRM
description: Web CRM (artifacts/office + artifacts/api-server) — key integration lessons.
---

# QuickProp Office

- POA prices use a separate `priceOnApplication` flag while keeping the numeric price at zero; never infer POA from zero alone. **Why:** property contracts and numeric price operations remain numeric, while a separate marker makes the buyer-facing “POA” label unambiguous. **How to apply:** preserve the flag through imports, property edits, publication sync, and every price display.
- Browser sessions use HMAC-signed tokens in the httpOnly `qp_uid` cookie; raw numeric cookies are rejected. **Why:** the old user-ID cookie could be forged, and the user approved requiring web users to sign in again after release. **How to apply:** keep browser identity signed and account for reauthentication when changing session validation.
- A Principal/Admin may deactivate their own account only while another active administrator remains; never remove the last active admin. **Why:** the user chose to make Douglas the sole admin immediately after his setup link is requested. **How to apply:** create the replacement admin first, then allow the current admin to sign out by deactivating themselves after all other admins are removed.
- Deleting a team profile must revoke sign-in and remove it from the active team list without deleting its business records; keep a non-login tombstone so existing references remain valid. **Why:** DBT Properties chose profile removal with listings, leads, tasks, viewings, and history preserved. **How to apply:** avoid cascading record deletion for Office team-profile removal.
- API server live checks: restart the managed API workflow after route changes because its dev command bundles before starting and does not hot-reload the running bundle. **Why:** otherwise endpoint probes can exercise stale authorization and response shapes. **How to apply:** restart before testing backend changes.
- Zod response schemas expect ISO string dates, but Drizzle returns `Date` objects — every `.parse(...)` of DB rows must go through `jsonify()` (JSON round-trip) in helpers. **How to apply:** any new route returning DB rows.
- Wouter gotcha: a custom `ProtectedRoute` that renders `<Component />` directly never receives URL params; wrap in `<Route path>{(params) => <Component params={params}/>}</Route>`.
- Seed script: no tsx in this monorepo; bundle `src/seed.ts` with esbuild (`external: ['pino','pino-pretty','pino-http']`, createRequire banner) then run `node dist/seed.mjs`. `packages:'external'` fails on workspace dir-import ESM.
- Orval hooks: passing custom `query` options (e.g. `enabled`) requires also supplying `queryKey` via the generated `get*QueryKey()` helper.
- Selling status is stored in `availabilityStatus`, while public visibility remains in `status`; sold and withdrawn records leave the active marketplace portfolio and sold metadata is shown in agent selling history. **Why:** visibility and sales lifecycle need to change independently. **How to apply:** use `availabilityStatus` for Office selling-status mutations and public-history queries.
- The property-detail mandate control changes the main property's mandate; a multi-agent agency offer has its own separate mandate. **Why:** the user selected the main property listing as the target. **How to apply:** don't change offer-level mandates when editing the property's mandate field.
- A multi-agent offer's displayed asking price belongs to that agency relationship, not the canonical property's price. **Why:** the user asked to edit the price shown in the agency-offer panel on mobile and Office. **How to apply:** update the relationship-scoped asking price and leave the main listing price unchanged.
