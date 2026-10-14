# Add Source and Docs ingestion UI

- Added shared Source, Docs, and Both actions with independent strictness controls, registered-input gating, admission errors, and project-change protection.
- Added separate Source/Docs head and readiness lanes, operation/child progress, partial-success messaging, cancellation, targeted retry, recent run history, and remembered operation receipts.
- Replaced legacy ingestion controls across Sources, Project Detail, ProjectDetailSheet, and Snapshots; snapshot summaries and details now use domain-specific readiness and leave missing legacy facts unknown.
- Scoped code Retrieval to published Source snapshots and blocked invalid URL-pinned Docs or unavailable IDs from automatic, form, or manual-refresh searches.

Validation: client suite 50/50 across six files; changed-file ESLint, scoped TypeScript, Vite production build, and `git diff --check` pass. A local browser smoke check opened `/sources` and confirmed the empty-source state renders without a route error; no configured input or ingestion was available to exercise a live operation. Build reports existing Rollup annotation and bundle-size warnings. Full application TypeScript checking remains blocked by 12 unrelated baseline missing-hook/Supabase/calendar diagnostics. Persistent-service acceptance remains S08 work.
