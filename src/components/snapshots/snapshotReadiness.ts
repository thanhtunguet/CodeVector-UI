import type { Snapshot } from '@/services/api';

export const snapshotReadinessRows = (snapshot: Snapshot) => {
  const source = [
    { label: 'Code graph', readiness: snapshot.codeGraph },
    { label: 'Code semantics', readiness: snapshot.codeSemantic },
  ];
  const docs = [
    { label: 'Document parse', readiness: snapshot.documentParse },
    { label: 'Document semantics', readiness: snapshot.documentSemantic },
  ];
  return snapshot.pipeline === 'source' ? source : snapshot.pipeline === 'docs' ? docs : [...source, ...docs];
};
