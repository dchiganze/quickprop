# QuickProp Agent

A premium mobile app for licensed estate agents to manage property listings, leads, buyer matches, and tasks in the field. Designed so an agent can go from standing at a property to publishing a live listing in under 5 minutes.

## Run & Operate

- Workflow: `artifacts/mobile: expo` — starts the Expo dev server
- Scan the QR code from the Expo server output with **Expo Go** on your phone to test natively
- Web preview is available but native (Expo Go) is the source of truth

## Stack

- Expo SDK 54 + Expo Router v6 (file-based routing)
- React Native + TypeScript
- React Query (@tanstack/react-query) for server state
- AsyncStorage for local data persistence
- NativeWind-compatible StyleSheet approach with useColors() tokens
- @expo/vector-icons (Ionicons, Feather)
- expo-image-picker for photo capture/upload
- expo-location for GPS coordinates
- expo-haptics for touch feedback

## App Structure

```
app/
  _layout.tsx          — Root layout, auth check, provider composition
  login.tsx            — Login screen (email/Google/Apple/Biometric)
  (tabs)/
    _layout.tsx        — 5-tab navigation (Dashboard, Listings, Leads, Matches, Profile)
    index.tsx          — Dashboard (stats, quick actions, tasks, recent listings)
    listings.tsx       — Property list with search + filter tabs
    leads.tsx          — Lead management with stage filter
    matches.tsx        — Buyer match cards
    profile.tsx        — Agent profile, stats, settings navigation
  listing/[id].tsx     — Property detail view
  lead/[id].tsx        — Lead detail with pipeline stage tracker
  new-listing.tsx      — 8-step listing wizard
  settings.tsx         — App settings

contexts/
  AuthContext.tsx      — Auth state, login/logout (AsyncStorage)
  DataContext.tsx      — Properties, leads, matches, tasks (AsyncStorage + mock data)

components/
  PropertyCard.tsx, LeadCard.tsx, BuyerMatchCard.tsx
  StatCard.tsx, SearchBar.tsx, FeatureChip.tsx
  StepIndicator.tsx, QuickAction.tsx, EmptyState.tsx

types/index.ts         — All TypeScript interfaces + feature list constants
constants/colors.ts    — QuickProp theme (deep blue + emerald green, dark mode support)
```

## Design System

- Primary: #1A3C6E (Deep Navy Blue)
- Accent: #10B981 (Emerald Green)  
- Background light: #F5F7FB | dark: #0B1929
- Card light: #FFFFFF | dark: #132035
- Radius: 14px

## Demo Login

Any email address and any password will log you in. Pre-populated with `demo@quickprop.co.zw`.

## Mock Data

Includes 6 sample properties (Borrowdale, Highlands, Greendale, Mount Pleasant, Avondale, Msasa), 4 leads, 4 buyer matches, 5 tasks — all set in Harare, Zimbabwe.
