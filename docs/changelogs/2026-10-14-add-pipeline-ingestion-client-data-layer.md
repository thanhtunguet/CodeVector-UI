# Add pipeline ingestion client data layer

- Added typed Source, Docs, and Both ingestion operations, pipeline status/readiness, cancellation, and linked retry API methods.
- Added pipeline-scoped snapshot queries, operation-aware query keys, pending-gap polling, terminal transition invalidation, and mutation hooks.
- Preserved the legacy aggregate ingestion hook and verified the new requests against the committed server contract.

Validation: ingestion data suite 16/16; client Vitest suite 28/28; changed-file ESLint and isolated TypeScript check pass; Vite production build passes. Full client typecheck remains blocked by unrelated pre-existing missing legacy hooks/Supabase modules and calendar IconLeft typing.
