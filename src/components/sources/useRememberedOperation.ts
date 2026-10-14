import { useQuery, useQueryClient } from '@tanstack/react-query';

// Keep the last admitted receipt discoverable even if it failed before a run was created.
const keyFor = (code: string) => ['projects', code, 'ingestion', 'last-admitted-operation'] as const;
const storageKey = (code: string) => `codevector:ingestion-operation:${code}`;
function readStored(code: string): string | undefined {
  try { return localStorage.getItem(storageKey(code)) || undefined; } catch { return undefined; }
}
export function useRememberedOperation(code: string) {
  const client = useQueryClient();
  const { data } = useQuery<string>({ queryKey: keyFor(code), queryFn: () => readStored(code) ?? '', initialData: () => readStored(code), enabled: false });
  const remember = (operationId: string) => {
    client.setQueryData(keyFor(code), operationId);
    try { localStorage.setItem(storageKey(code), operationId); } catch { /* In-memory tracking remains available. */ }
  };
  return { operationId: data || undefined, remember };
}
