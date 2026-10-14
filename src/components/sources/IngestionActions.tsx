import { useState } from 'react';
import { BookOpen, ChevronDown, Code2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  return <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ingestion actions">
    <div className="inline-flex" title={reason}>
      <Button size="sm" disabled={disabled} onClick={() => setTarget('both')} className="h-9 gap-1.5 rounded-r-none text-xs">
        <Layers className="h-3.5 w-3.5" />Ingest Both
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={disabled} aria-label="Choose ingestion pipeline" className="h-9 rounded-l-none border-l border-primary-foreground/20 px-2">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTarget('source')}>
            <Code2 className="mr-2 h-3.5 w-3.5" />Ingest Source
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTarget('docs')}>
            <BookOpen className="mr-2 h-3.5 w-3.5" />Ingest Docs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <TriggerIngestionDialog open={target !== null} onOpenChange={open => { if (!open) setTarget(null); }} projectCode={projectCode} projectName={projectName} pipeline={target ?? 'source'} />
  </div>;
}
