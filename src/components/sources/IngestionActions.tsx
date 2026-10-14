import { useState } from 'react';
import { BookOpen, Code2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectIngestion } from '@/hooks/useIngestion';
import { useProjectSources } from '@/hooks/useProjects';
import { isIngestionActive } from '@/hooks/ingestionQueries';
import { TriggerIngestionDialog, type IngestionTarget } from './TriggerIngestionDialog';

interface Props { projectCode: string; projectName?: string }
export function IngestionActions(props: Props) {
  return <ProjectIngestionActions key={props.projectCode} {...props} />;
}
function ProjectIngestionActions({ projectCode, projectName }: Props) {
  const [target, setTarget] = useState<IngestionTarget | null>(null);
  const { data: status, isPending, error } = useProjectIngestion(projectCode || undefined);
  const { data: sources, isPending: sourcesLoading, error: sourcesError } = useProjectSources(projectCode || undefined);
  const busy = isIngestionActive(status);
  const disabled = !projectCode || isPending || !!error || sourcesLoading || !!sourcesError || !sources?.length || busy;
  const reason = busy ? 'Project ingestion is active or pending' : !sourcesLoading && !sourcesError && !sources?.length ? 'Register an input directory first' : error?.message || sourcesError?.message;
  return <div className="flex flex-wrap items-center gap-1.5" aria-label="Ingestion actions">
    {(['source', 'docs', 'both'] as const).map(pipeline => {
      const Icon = pipeline === 'source' ? Code2 : pipeline === 'docs' ? BookOpen : Layers;
      const label = pipeline === 'source' ? 'Source' : pipeline === 'docs' ? 'Docs' : 'Both';
      return <Button key={pipeline} variant="outline" size="sm" disabled={disabled} title={reason} onClick={() => setTarget(pipeline)} className="h-9 gap-1.5 text-xs border-primary/20 text-primary bg-primary/5 hover:bg-primary/10">
        <Icon className="h-3.5 w-3.5" />Ingest {label}
      </Button>;
    })}
    <TriggerIngestionDialog open={target !== null} onOpenChange={open => { if (!open) setTarget(null); }} projectCode={projectCode} projectName={projectName} pipeline={target ?? 'source'} />
  </div>;
}
