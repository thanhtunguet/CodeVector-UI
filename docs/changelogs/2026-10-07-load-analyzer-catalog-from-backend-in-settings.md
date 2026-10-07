Load analyzer catalog from backend in Settings

Settings now renders analyzer metadata from the backend catalog and uses a
localStorage copy for immediate display while refreshing the list on mount.

Workspace and tooling
- No workspace or tooling changes.

Modules
- client: Added the analyzer catalog API client and a validated localStorage-backed query. Settings reads display metadata from the API, combines it with live capabilities, and maps backend icon keys to Lucide components.

Verification
- `pnpm exec eslint src/hooks/useSettings.ts src/pages/Settings.tsx src/services/api.ts` passed.
- `pnpm exec tsc --noEmit` passed.
- `git diff --check` passed.
