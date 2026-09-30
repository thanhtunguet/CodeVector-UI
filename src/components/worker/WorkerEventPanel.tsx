import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cancelIngestionRun, getWorkerEvents, workerEventStreamUrl, type WorkerEvent } from '@/services/workerEvents';
import type { IngestionRun } from '@/services/api';

interface WorkerEventPanelProps {
  projectCode?: string;
  runId?: string;
  snapshotId?: string;
  activeRun?: IngestionRun;
  title?: string;
  compact?: boolean;
}

function mergeEvents(current: WorkerEvent[], incoming: WorkerEvent[]): WorkerEvent[] {
  const events = new Map(current.map((event) => [event.cursor, event]));
  for (const event of incoming) events.set(event.cursor, event);
  return [...events.values()].sort((left, right) => BigInt(left.cursor) < BigInt(right.cursor) ? -1 : 1);
}

function eventTone(level: WorkerEvent['level']): string {
  if (level === 'error') return 'text-destructive';
  if (level === 'warn') return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export function WorkerEventPanel({
  projectCode,
  runId,
  snapshotId,
  activeRun,
  title = 'Compute worker events',
  compact = false,
}: WorkerEventPanelProps) {
  const [events, setEvents] = useState<WorkerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedError, setFeedError] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  const [cancelSent, setCancelSent] = useState(false);
  const newestCursor = useRef('0');
  const oldestCursor = useRef<string | undefined>(undefined);
  const scope = useMemo(() => ({ projectCode, runId, snapshotId }), [projectCode, runId, snapshotId]);
  const scopeKey = `${projectCode ?? ''}:${runId ?? ''}:${snapshotId ?? ''}`;

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let stream: EventSource | undefined;
    let polling = false;
    newestCursor.current = '0';
    oldestCursor.current = undefined;
    setEvents([]);
    setLoading(true);
    setFeedError(undefined);
    setCancelError(undefined);
    setCancelSent(false);

    const addEvents = (incoming: WorkerEvent[]) => {
      if (disposed || incoming.length === 0) return;
      setEvents((current) => mergeEvents(current, incoming));
      for (const event of incoming) {
        if (BigInt(event.cursor) > BigInt(newestCursor.current)) newestCursor.current = event.cursor;
        if (!oldestCursor.current || BigInt(event.cursor) < BigInt(oldestCursor.current)) {
          oldestCursor.current = event.cursor;
        }
      }
    };

    const poll = async () => {
      if (polling || disposed) return;
      polling = true;
      try {
        // Drain a bounded number of pages if the feed accumulated events while
        // the browser was offline. The next interval resumes from the cursor.
        for (let pageNo = 0; pageNo < 3; pageNo += 1) {
          const page = await getWorkerEvents(scope, { after: newestCursor.current, limit: 100 });
          addEvents(page.events);
          if (!page.hasMore) break;
        }
        setFeedError(undefined);
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : 'Worker events are temporarily unavailable');
      } finally {
        polling = false;
      }
    };

    void getWorkerEvents(scope, { limit: 50 })
      .then((page) => {
        if (disposed) return;
        addEvents(page.events);
        setHasMore(page.hasMore);
        setLoading(false);
        // Resume from the snapshot GET cursor so events created between the
        // initial page and stream connection cannot be skipped.
        stream = new EventSource(workerEventStreamUrl(scope, newestCursor.current));
        stream.addEventListener('open', () => {
          if (!disposed) {
            setStreaming(true);
            setFeedError(undefined);
          }
        });
        stream.addEventListener('worker-event', (message) => {
          try {
            addEvents([JSON.parse((message as MessageEvent<string>).data) as WorkerEvent]);
          } catch {
            // Ignore malformed stream frames; polling remains a recovery path.
          }
        });
        stream.addEventListener('error', () => {
          stream?.close();
          if (!disposed) {
            setStreaming(false);
            pollTimer = setInterval(() => void poll(), 3_000);
            void poll();
          }
        });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setFeedError(error instanceof Error ? error.message : 'Worker events are temporarily unavailable');
        setLoading(false);
        pollTimer = setInterval(() => void poll(), 3_000);
      });

    return () => {
      disposed = true;
      stream?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [scope, scopeKey]);

  const loadOlder = async () => {
    if (!oldestCursor.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getWorkerEvents(scope, { before: oldestCursor.current, limit: 50 });
      setEvents((current) => mergeEvents(current, page.events));
      if (page.events.length > 0) oldestCursor.current = page.events[0]?.cursor;
      setHasMore(page.hasMore);
      setFeedError(undefined);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Older worker events could not be loaded');
    } finally {
      setLoadingOlder(false);
    }
  };

  const requestCancel = async () => {
    if (!projectCode || !activeRun) return;
    setCancelError(undefined);
    try {
      await cancelIngestionRun(projectCode, activeRun.id);
      setCancelSent(true);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Cancellation request failed');
    }
  };

  const lastContact = activeRun?.lastEmbeddingObservedAt;
  const stalled = activeRun?.state === 'running' && activeRun.stage === 'embedding' && (
    (Boolean(lastContact) && Date.now() - new Date(lastContact!).getTime() > 60_000) ||
    (!lastContact && (activeRun.embeddingCommunicationFailures ?? 0) >= 3)
  );
  const progressTotal = activeRun?.currentEmbeddingTotal ?? 0;
  const progressDone = activeRun?.currentEmbeddingCompleted ?? 0;
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round(progressDone / progressTotal * 100)) : 0;

  return (
    <Card className={compact ? 'border-border/70' : undefined}>
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="mt-1">
              {streaming ? 'Live event stream' : 'Stored event history'}
              {lastContact ? ` · Last worker contact ${new Date(lastContact).toLocaleString()}` : ''}
            </CardDescription>
          </div>
          {activeRun && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={stalled ? 'destructive' : 'outline'}>
                {stalled ? 'Stalled' : activeRun.state === 'running' ? 'Running' : activeRun.state}
              </Badge>
              {activeRun.currentEmbeddingJobState && (
                <Badge variant="secondary">{activeRun.currentEmbeddingJobState}</Badge>
              )}
              {(activeRun.embeddingCommunicationFailures ?? 0) > 0 && (
                <Badge variant="outline">
                  {activeRun.embeddingCommunicationFailures} consecutive communication {activeRun.embeddingCommunicationFailures === 1 ? 'failure' : 'failures'}
                </Badge>
              )}
              {stalled && !activeRun.cancelRequestedAt && !cancelSent && (
                <Button size="sm" variant="outline" onClick={() => void requestCancel()}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel run
                </Button>
              )}
              {(activeRun.cancelRequestedAt || cancelSent) && <Badge variant="secondary">Cancel requested</Badge>}
            </div>
          )}
        </div>
        {activeRun && progressTotal > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Attempt {activeRun.currentEmbeddingAttempt ?? 0}</span>
              <span>{progressDone}/{progressTotal} ({progressPercent}%)</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {feedError && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{feedError}. Earlier events remain available.</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void getWorkerEvents(scope, { after: newestCursor.current, limit: 100 }).then((page) => {
              setEvents((current) => mergeEvents(current, page.events));
              setFeedError(undefined);
            }).catch(() => undefined)}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
        {hasMore && (
          <Button size="sm" variant="outline" disabled={loadingOlder} onClick={() => void loadOlder()}>
            {loadingOlder && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Load older events
          </Button>
        )}
        {loading ? (
          <p className="py-3 text-xs text-muted-foreground">Loading worker event history…</p>
        ) : events.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No worker events recorded yet.</p>
        ) : (
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {events.map((event) => (
              <li key={event.cursor} className="grid grid-cols-[auto_1fr] gap-x-3 rounded-md border border-border/60 px-3 py-2 text-xs">
                <time className="font-mono text-[10px] text-muted-foreground" dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-medium capitalize ${eventTone(event.level)}`}>{event.level}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{event.kind}</span>
                    {event.attempt !== undefined && <span className="text-muted-foreground">Attempt {event.attempt}</span>}
                    {event.completed !== undefined && event.total !== undefined && (
                      <span className="text-muted-foreground">{event.completed}/{event.total}</span>
                    )}
                    {event.consecutiveFailures !== undefined && (
                      <span className="text-muted-foreground">{event.consecutiveFailures} consecutive failures</span>
                    )}
                  </div>
                  <p className="mt-0.5 break-words text-foreground">{event.message}{event.reasonCode ? ` (${event.reasonCode})` : ''}</p>
                  {event.jobId && <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">Job {event.jobId}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
