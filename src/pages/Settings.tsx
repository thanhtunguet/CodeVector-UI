import { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCode,
  FileCode2,
  FileText,
  Globe,
  Info,
  Layers,
  Network,
  RefreshCw,
  Server,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities, useSystemHealth } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { WorkerEventPanel } from '@/components/worker/WorkerEventPanel';
import type {
  AdapterCapability,
  DependencyProbeReport,
  DependencyProbeStatus,
} from '@/services/api';
import { format } from 'date-fns';

function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h ${remainingMinutes}m`;
}

function formatCheckTime(isoString?: string): string {
  if (!isoString) return 'Never';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return format(d, 'MMM d, yyyy HH:mm:ss');
  } catch {
    return isoString;
  }
}

interface KnownAdapterMeta {
  name: string;
  extensions: string[];
  description: string;
  defaultLevel: 'syntax' | 'semantic' | 'text';
  icon: React.ComponentType<{ className?: string }>;
}

const KNOWN_ADAPTERS: Record<string, KnownAdapterMeta> = {
  typescript: {
    name: 'TypeScript / JavaScript',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    description:
      'Full AST traversal, symbol extraction, import resolution, and call graph analysis via TypeScript compiler.',
    defaultLevel: 'syntax',
    icon: FileCode2,
  },
  python: {
    name: 'Python',
    extensions: ['.py', '.pyi'],
    description:
      'Abstract syntax tree parsing, function and class symbol extraction, and module hierarchy mapping.',
    defaultLevel: 'syntax',
    icon: FileCode,
  },
  go: {
    name: 'Go',
    extensions: ['.go'],
    description:
      'Go syntax tree parsing, package declarations, struct and method symbol mapping, and relationship indexing.',
    defaultLevel: 'syntax',
    icon: Code2,
  },
  bash: {
    name: 'Bash / Shell',
    extensions: ['.sh', '.bash', '.bats'],
    description: 'Shell functions, variables, source dependencies, and command references.',
    defaultLevel: 'semantic',
    icon: Terminal,
  },
  markdown: {
    name: 'Markdown',
    extensions: ['.md', '.markdown', '.mdx'],
    description:
      'Structural heading hierarchy parsing, content chunking, document symbol mapping, and textual context extraction.',
    defaultLevel: 'text',
    icon: FileText,
  },
};

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [copiedDiag, setCopiedDiag] = useState(false);

  const {
    data: health,
    isLoading: isHealthLoading,
    isFetching: isHealthFetching,
    isError: isHealthError,
    refetch: refetchHealth,
  } = useSystemHealth({ refetchInterval: 10000 });

  const {
    data: capabilities,
    isLoading: isCapLoading,
    isFetching: isCapFetching,
    refetch: refetchCapabilities,
  } = useCapabilities();

  const isRefreshing = isHealthFetching || isCapFetching;

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchHealth(), refetchCapabilities()]);
      toast({
        title: 'System Health Refreshed',
        description: `Probes updated at ${format(new Date(), 'HH:mm:ss')}`,
      });
    } catch (err) {
      toast({
        title: 'Refresh Failed',
        description: err instanceof Error ? err.message : 'Failed to query subsystem probes',
        variant: 'destructive',
      });
    }
  };

  const handleCopyDiagnostics = () => {
    const diagData = {
      timestamp: new Date().toISOString(),
      health,
      capabilities,
      clientEnv: {
        mode: import.meta.env.MODE,
        apiUrl: import.meta.env.VITE_API_URL || '/api',
      },
    };
    navigator.clipboard.writeText(JSON.stringify(diagData, null, 2));
    setCopiedDiag(true);
    toast({
      title: 'Diagnostics Copied',
      description: 'System health and capabilities JSON copied to clipboard.',
    });
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  // Compute normalized status for probes
  const probes = health?.probes || {};
  const dependencies = health?.dependencies || [];

  const postgresProbe = probes['postgres'] || dependencies.find((d) => d.name === 'postgres');
  const postgresMetaProbe = probes['postgres-metadata'] || dependencies.find((d) => d.name === 'postgres-metadata');
  const neo4jProbe = probes['neo4j'] || dependencies.find((d) => d.name === 'neo4j');
  const qdrantProbe = probes['qdrant'] || dependencies.find((d) => d.name === 'qdrant');
  const computeProbe =
    probes['compute-worker'] ||
    probes['compute_worker'] ||
    dependencies.find((d) => d.name === 'compute-worker' || d.name === 'compute_worker');

  // Compute worker capability normalization
  const computeWorkerAvailable = Boolean(
    computeProbe?.status === 'up' &&
      capabilities?.computeWorker &&
      capabilities.computeWorker.available !== false &&
      (capabilities.computeWorker.capabilities
        ? capabilities.computeWorker.capabilities.find((c) => c.name === 'embeddings')?.available
        : true)
  );

  const embeddingConfig = capabilities?.computeWorker?.capabilities?.find(
    (c) => c.name === 'embeddings'
  )?.config;

  const embeddingModelId =
    capabilities?.computeWorker?.modelId ||
    (embeddingConfig?.model as string | undefined) ||
    (computeWorkerAvailable ? 'all-MiniLM-L6-v2' : 'None');

  const embeddingDimensions =
    capabilities?.computeWorker?.dimensions ||
    (embeddingConfig?.dimensions as number | undefined) ||
    (computeWorkerAvailable ? 384 : undefined);

  const embeddingBatchSize = (embeddingConfig?.batch_size as number | undefined) || 32;
  const embeddingConcurrency = (embeddingConfig?.max_concurrency as number | undefined) || 4;

  const computeWorkerReason =
    capabilities?.computeWorker?.reason ||
    (computeProbe?.detail ?? (computeWorkerAvailable ? undefined : 'Compute worker unreachable or unconfigured'));

  // Normalized adapter list
  const adapterList = useMemo(() => {
    const serverAdapters = capabilities?.server?.adapters || [];
    const keys = new Set([
      'typescript',
      'python',
      'go',
      'markdown',
      ...serverAdapters.map((a) => a.language.toLowerCase()),
    ]);

    return Array.from(keys).map((langKey) => {
      const serverEntry = serverAdapters.find((a) => a.language.toLowerCase() === langKey);
      const known = KNOWN_ADAPTERS[langKey];
      return {
        id: langKey,
        name: known?.name || serverEntry?.language || langKey.toUpperCase(),
        level: (serverEntry?.level || serverEntry?.capability || known?.defaultLevel || 'syntax') as
          | 'syntax'
          | 'semantic'
          | 'text',
        extensions: serverEntry?.extensions || known?.extensions || [],
        description: serverEntry?.description || known?.description || 'Code syntax parser and symbol extractor.',
        available: serverEntry ? serverEntry.available !== false : true,
        Icon: known?.icon || FileCode,
      };
    });
  }, [capabilities?.server?.adapters]);

  // Overall probe statistics
  const coreProbes = [postgresProbe, neo4jProbe, qdrantProbe, computeProbe].filter(Boolean);
  const upProbesCount = coreProbes.filter((p) => p?.status === 'up').length;
  const totalProbesCount = 4;

  const avgLatency = useMemo(() => {
    const valid = coreProbes.filter((p) => p && typeof p.latencyMs === 'number' && p.latencyMs >= 0);
    if (!valid.length) return null;
    const sum = valid.reduce((acc, curr) => acc + (curr?.latencyMs ?? 0), 0);
    return Math.round(sum / valid.length);
  }, [coreProbes]);

  const isClusterOperational = !isHealthError && health?.ready === true;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Settings & System Health
            </h1>
            {isHealthLoading ? (
              <Badge variant="outline" className="px-3 py-1 text-xs font-medium gap-1.5 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
              </Badge>
            ) : isHealthError ? (
              <Badge variant="destructive" className="px-3 py-1 text-xs font-medium gap-1.5">
                <XCircle className="h-3 w-3" /> Connection Error
              </Badge>
            ) : isClusterOperational ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1 text-xs font-medium gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Operational
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20 px-3 py-1 text-xs font-medium gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Degraded
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Monitor cluster readiness, probe individual subsystem latency, verify language adapter
            capabilities, and review compute worker configurations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyDiagnostics}
            className="text-xs gap-1.5"
          >
            {copiedDiag ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Diagnostics</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </Button>
        </div>
      </div>

      {/* Top Level Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cluster Readiness */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cluster Readiness
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {isHealthLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : isClusterOperational ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Operational
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Degraded
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Checked {formatCheckTime(health?.checkedAt)}
            </p>
          </CardContent>
        </Card>

        {/* Subsystems Health */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Subsystems
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {isHealthLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span>
                  {upProbesCount} / {totalProbesCount} Online
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {avgLatency !== null ? `Average latency ~${avgLatency} ms` : 'Probing latency...'}
            </p>
          </CardContent>
        </Card>

        {/* Language Adapters */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Language Adapters
            </CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {isCapLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span>{adapterList.length} Registered</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              TypeScript, Python, Go, Markdown
            </p>
          </CardContent>
        </Card>

        {/* AI Compute Worker */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Compute Worker
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">
              {isCapLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : computeWorkerAvailable ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Active
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Graceful Fallback
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              {computeWorkerAvailable ? `${embeddingModelId} (${embeddingDimensions}d)` : 'Graph-only fallback active'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-1.5">
            Full Overview
          </TabsTrigger>
          <TabsTrigger value="probes" className="text-xs py-1.5">
            Infrastructure Probes
          </TabsTrigger>
          <TabsTrigger value="adapters" className="text-xs py-1.5">
            Language Adapters
          </TabsTrigger>
          <TabsTrigger value="compute" className="text-xs py-1.5">
            Compute AI Worker
          </TabsTrigger>
          <TabsTrigger value="runtime" className="text-xs py-1.5">
            Runtime & Environment
          </TabsTrigger>
        </TabsList>

        {/* TAB: Overview (Contains all sections in order) */}
        <TabsContent value="overview" className="space-y-8 mt-0">
          <ProbesSection
            postgresProbe={postgresProbe}
            postgresMetaProbe={postgresMetaProbe}
            neo4jProbe={neo4jProbe}
            qdrantProbe={qdrantProbe}
            computeProbe={computeProbe}
            isLoading={isHealthLoading}
          />

          <AdaptersSection adapters={adapterList} isLoading={isCapLoading} />

          <ComputeWorkerSection
            available={computeWorkerAvailable}
            modelId={embeddingModelId}
            dimensions={embeddingDimensions}
            batchSize={embeddingBatchSize}
            maxConcurrency={embeddingConcurrency}
            reason={computeWorkerReason}
            isLoading={isCapLoading}
          />

          <WorkerEventPanel title="Worker-wide event history" compact />

          <RuntimeSection health={health} isLoading={isHealthLoading} />
        </TabsContent>

        {/* TAB: Probes Only */}
        <TabsContent value="probes" className="space-y-6 mt-0">
          <ProbesSection
            postgresProbe={postgresProbe}
            postgresMetaProbe={postgresMetaProbe}
            neo4jProbe={neo4jProbe}
            qdrantProbe={qdrantProbe}
            computeProbe={computeProbe}
            isLoading={isHealthLoading}
          />
        </TabsContent>

        {/* TAB: Language Adapters */}
        <TabsContent value="adapters" className="space-y-6 mt-0">
          <AdaptersSection adapters={adapterList} isLoading={isCapLoading} />
        </TabsContent>

        {/* TAB: Compute Worker AI */}
        <TabsContent value="compute" className="space-y-6 mt-0">
          <ComputeWorkerSection
            available={computeWorkerAvailable}
            modelId={embeddingModelId}
            dimensions={embeddingDimensions}
            batchSize={embeddingBatchSize}
            maxConcurrency={embeddingConcurrency}
            reason={computeWorkerReason}
            isLoading={isCapLoading}
          />
          <WorkerEventPanel title="Worker-wide event history" compact />
        </TabsContent>

        {/* TAB: Runtime & Environment */}
        <TabsContent value="runtime" className="space-y-6 mt-0">
          <RuntimeSection health={health} isLoading={isHealthLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBSECTION: Infrastructure Subsystem Probes
// ---------------------------------------------------------------------------

interface ProbeCardProps {
  name: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  probe?: DependencyProbeReport;
  required: boolean;
  subdetail?: string;
  defaultOkDetail: string;
  isLoading: boolean;
}

function ProbeStatusBadge({ status }: { status?: DependencyProbeStatus }) {
  if (status === 'up') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-xs gap-1">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </Badge>
    );
  }
  if (status === 'down') {
    return (
      <Badge variant="destructive" className="font-medium text-xs gap-1">
        <XCircle className="h-3 w-3" /> Down
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-medium text-xs gap-1 text-muted-foreground">
      <AlertCircle className="h-3 w-3" /> Not Configured
    </Badge>
  );
}

function LatencyBadge({ latencyMs }: { latencyMs?: number }) {
  if (latencyMs === undefined || latencyMs === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  let colorClasses = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (latencyMs > 200) {
    colorClasses = 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  } else if (latencyMs > 80) {
    colorClasses = 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono font-medium border ${colorClasses}`}
    >
      <Clock className="h-3 w-3" />
      {latencyMs} ms
    </span>
  );
}

function ProbeCard({
  name,
  role,
  icon: Icon,
  probe,
  required,
  subdetail,
  defaultOkDetail,
  isLoading,
}: ProbeCardProps) {
  const isUp = probe?.status === 'up';

  return (
    <Card className="flex flex-col justify-between shadow-sm border transition-colors hover:border-foreground/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg border ${
                isUp
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : probe?.status === 'down'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">{name}</CardTitle>
              <CardDescription className="text-xs line-clamp-1 mt-0.5">{role}</CardDescription>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {isLoading ? <Skeleton className="h-5 w-16" /> : <ProbeStatusBadge status={probe?.status} />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3 text-xs flex-1">
        <div className="flex items-center justify-between border-t pt-2.5 text-muted-foreground">
          <span className="font-medium">Probe Latency</span>
          {isLoading ? <Skeleton className="h-4 w-12" /> : <LatencyBadge latencyMs={probe?.latencyMs} />}
        </div>

        <div className="space-y-1">
          <span className="font-medium text-foreground block">Diagnostics</span>
          <div className="rounded bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground min-h-[38px] break-words">
            {isLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : probe?.detail ? (
              <span className={isUp ? 'text-foreground' : 'text-red-500 dark:text-red-400'}>
                {probe.detail}
              </span>
            ) : isUp ? (
              defaultOkDetail
            ) : (
              'Subsystem unreachable or unresponsive.'
            )}
          </div>
        </div>

        {subdetail && (
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{subdetail}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 pb-3 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{required ? 'Required Core Subsystem' : 'Optional (Graceful Degradation)'}</span>
        <span className="capitalize">{probe?.status || 'unprobed'}</span>
      </CardFooter>
    </Card>
  );
}

function ProbesSection({
  postgresProbe,
  postgresMetaProbe,
  neo4jProbe,
  qdrantProbe,
  computeProbe,
  isLoading,
}: {
  postgresProbe?: DependencyProbeReport;
  postgresMetaProbe?: DependencyProbeReport;
  neo4jProbe?: DependencyProbeReport;
  qdrantProbe?: DependencyProbeReport;
  computeProbe?: DependencyProbeReport;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Infrastructure Subsystem Probes
          </h2>
          <p className="text-xs text-muted-foreground">
            Direct dependency health probes evaluating database connectivity, storage integrity, and worker responsiveness.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PostgreSQL */}
        <ProbeCard
          name="PostgreSQL"
          role="Metadata persistence & lease management"
          icon={Database}
          probe={postgresProbe}
          required={true}
          subdetail={
            postgresMetaProbe?.status === 'up'
              ? 'Metadata Schema: Applied & Verified'
              : postgresMetaProbe?.detail
          }
          defaultOkDetail="Active pool connection • Transactions and leases responsive."
          isLoading={isLoading}
        />

        {/* Neo4j */}
        <ProbeCard
          name="Neo4j"
          role="Code property graph & relationship store"
          icon={Share2}
          probe={neo4jProbe}
          required={true}
          defaultOkDetail="Bolt driver operational • CPG queries and traversal functional."
          isLoading={isLoading}
        />

        {/* Qdrant */}
        <ProbeCard
          name="Qdrant"
          role="Vector search & semantic embeddings"
          icon={Layers}
          probe={qdrantProbe}
          required={true}
          defaultOkDetail="Vector collection reachable • High-dimensional ANN queries operational."
          isLoading={isLoading}
        />

        {/* Compute Worker */}
        <ProbeCard
          name="Compute Worker"
          role="AI embeddings & document chunking"
          icon={Cpu}
          probe={computeProbe}
          required={false}
          defaultOkDetail="FastAPI worker active • Sentence-transformer models loaded."
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBSECTION: Language Adapter Registry
// ---------------------------------------------------------------------------

function CapabilityLevelBadge({ level }: { level: 'syntax' | 'semantic' | 'text' | string }) {
  if (level === 'semantic') {
    return (
      <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium text-xs">
        semantic
      </Badge>
    );
  }
  if (level === 'text') {
    return (
      <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-medium text-xs">
        text
      </Badge>
    );
  }
  return (
    <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-medium text-xs">
      syntax
    </Badge>
  );
}

function AdaptersSection({
  adapters,
  isLoading,
}: {
  adapters: Array<{
    id: string;
    name: string;
    level: 'syntax' | 'semantic' | 'text';
    extensions: readonly string[] | string[];
    description: string;
    available: boolean;
    Icon: React.ComponentType<{ className?: string }>;
  }>;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Language Adapter Registry
          </h2>
          <p className="text-xs text-muted-foreground">
            Registered AST parsers, language frontends, and text chunkers configured in the ingestion engine.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-muted/40 font-mono">
            {adapters.length} Analyzers Loaded
          </Badge>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[200px]">Adapter / Language</TableHead>
              <TableHead className="w-[140px]">Capability</TableHead>
              <TableHead className="w-[240px]">Supported Extensions</TableHead>
              <TableHead>Ingestion Analysis Role</TableHead>
              <TableHead className="w-[110px] text-right">State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-64" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-5 w-16 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              adapters.map((adapter) => {
                const { Icon } = adapter;
                return (
                  <TableRow key={adapter.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-muted text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs leading-none">{adapter.name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {adapter.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CapabilityLevelBadge level={adapter.level} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {adapter.extensions.map((ext) => (
                          <span
                            key={ext}
                            className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground border border-border"
                          >
                            {ext}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground leading-relaxed">
                      {adapter.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {adapter.available ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Offline
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBSECTION: Compute Worker AI Configuration
// ---------------------------------------------------------------------------

function ComputeWorkerSection({
  available,
  modelId,
  dimensions,
  batchSize,
  maxConcurrency,
  reason,
  isLoading,
}: {
  available: boolean;
  modelId?: string;
  dimensions?: number;
  batchSize?: number;
  maxConcurrency?: number;
  reason?: string;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Compute Worker AI Configuration
          </h2>
          <p className="text-xs text-muted-foreground">
            Vector embedding models, dimensional parameters, batch concurrency, and graceful fallback routing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Worker Status & Specs */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Embedding Model Parameters</CardTitle>
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : available ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Worker Online
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" /> Worker Offline
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Live advertised parameters published by the Python FastAPI compute worker service.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!available && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-xs font-semibold">
                  Compute Worker Offline — Graceful Degradation Active
                </AlertTitle>
                <AlertDescription className="text-xs mt-1 leading-relaxed">
                  {reason || 'The compute worker is unreachable or unconfigured.'} Ingestion runs
                  will continue smoothly using TypeScript, Python, and Go syntax ASTs and Neo4j graph
                  hierarchies, reporting index capability as <code className="font-semibold">graph_only</code>.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Embedding Model
                </div>
                <div className="text-sm font-semibold font-mono mt-1 truncate" title={modelId}>
                  {isLoading ? <Skeleton className="h-5 w-28" /> : modelId || 'None'}
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Vector Dimensions
                </div>
                <div className="text-sm font-semibold font-mono mt-1">
                  {isLoading ? <Skeleton className="h-5 w-16" /> : dimensions ? `${dimensions}d` : 'N/A'}
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Batch Size
                </div>
                <div className="text-sm font-semibold font-mono mt-1">
                  {isLoading ? <Skeleton className="h-5 w-12" /> : batchSize ? `${batchSize} chunks` : '32'}
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Concurrency
                </div>
                <div className="text-sm font-semibold font-mono mt-1">
                  {isLoading ? <Skeleton className="h-5 w-12" /> : maxConcurrency ? `${maxConcurrency} workers` : '4'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resilience & Architecture Callout */}
        <Card className="shadow-sm bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Intelligence Modes
            </CardTitle>
            <CardDescription className="text-xs">
              CodeVector automatically tunes snapshot capabilities according to compute availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Full Hybrid Mode:</strong> Graph AST + Semantic Vector
                Search. Active when PostgreSQL, Neo4j, Qdrant, and Compute Worker are all up.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Graph-Only Fallback:</strong> Structural symbol
                resolution, call chains, and lexical search remain completely functional without AI compute.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBSECTION: Runtime & Environment Information
// ---------------------------------------------------------------------------

function RuntimeSection({
  health,
  isLoading,
}: {
  health?: {
    version?: string;
    uptimeSeconds?: number;
    checkedAt?: string;
    [key: string]: unknown;
  };
  isLoading: boolean;
}) {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const clientMode = import.meta.env.MODE;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Runtime & Environment Information
          </h2>
          <p className="text-xs text-muted-foreground">
            Server build version, daemon uptime, client transport mode, and cluster environment settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server Version */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono">
              {isLoading ? <Skeleton className="h-6 w-20" /> : health?.version || '0.1.0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">CodeVector Core Engine</p>
          </CardContent>
        </Card>

        {/* Server Uptime */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono">
              {isLoading ? <Skeleton className="h-6 w-24" /> : formatUptime(health?.uptimeSeconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Daemon process duration</p>
          </CardContent>
        </Card>

        {/* Client API URL */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              API Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold font-mono truncate" title={apiUrl}>
              {apiUrl}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Transport endpoint configuration</p>
          </CardContent>
        </Card>

        {/* Client Mode */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono capitalize">{clientMode}</div>
            <p className="text-xs text-muted-foreground mt-1">Vite production bundle</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
