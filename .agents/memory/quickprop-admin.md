---
name: QuickProp Admin Portal
description: Architecture decisions and lessons for the admin portal at artifacts/admin
---

## Stack
- React 19 + Vite + Tailwind CSS 4 + Wouter + TanStack Query
- Same @workspace/api-client-react as Office — all generated hooks shared
- Preview path: /admin/ — base URL handled by import.meta.env.BASE_URL

## Color theme (deep navy + electric blue — different from emerald Office)
- sidebar: 222 47% 11% (very dark navy)
- primary: 217 91% 60% (electric blue)
- background: 222 20% 97% (cool light gray)
- See artifacts/admin/src/index.css for full token set

## New API routes (admin-portal.ts)
All at GET/PATCH /admin/* with requireRole("principal","admin") middleware:
- GET /admin/platform-stats → AdminPlatformStats
- GET /admin/platform-charts → AdminPlatformCharts
- GET /admin/coverage → AdminCoverage
- GET /admin/freshness → AdminFreshness
- GET /admin/agents → AdminAgent[]
- GET /admin/agencies → AdminAgency[]
- PATCH /admin/properties/:id/moderate → action: approve|hide|flag|expire|restore

## OpenAPI codegen flow
Codegen is in lib/api-spec: `cd lib/api-spec && pnpm run codegen`
Generates to lib/api-client-react/src/generated/ (api.ts + api.schemas.ts)
If codegen cleans then fails, it leaves generated/ empty — ALL frontend apps break until fixed.
Duplicate schema names in openapi.yaml cause "Failed to resolve input" error.

## BuyerUpdate interface (lesson)
BuyerUpdate does NOT have a status field. Cannot suspend buyers via API.
Status management for buyers requires a separate admin endpoint if needed.

## useGetLeadTimeline options
Hook signature: useGetLeadTimeline(id, { query?: UseQueryOptions<...> })
The `enabled` option goes inside query: { query: { enabled: expanded } as any }
(exact UseQueryOptions type requires queryKey which is auto-generated internally)

## Seeded admin users
- nyasha@quickprop.co.zw — role: admin
- rutendo@quickprop.co.zw — role: principal
Both can access admin portal. Password: demo1234

## Pages built
login, dashboard (12 KPIs + 5 charts), properties (with moderation), agencies, agents,
buyers, leads (with expandable timeline), coverage (progress bars), freshness (30/60/90d tabs),
audit log, settings (placeholder sections)
