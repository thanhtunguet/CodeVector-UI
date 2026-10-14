import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import {
  cancelIngestionOperation, cancelIngestionRun, getIngestionOperation, getProjectIngestion,
  retryPipelineIngest, triggerPipelineIngest,
  type IngestionOperation, type IngestionPipeline, type IngestionStatus,
  type PipelineIngestRequest, type PipelineRetryRequest,
} from '@/services/api';
import {
  ingestionKeys, invalidateIngestionViews, isIngestionActive, isOperationActive, terminalIngestionKeys,
} from './ingestionQueries';

export interface IngestionPollingOptions {
  refetchInterval?: number | false | ((query: Query<IngestionStatus, Error>) => number | false | undefined);
}

function useIngestionTransitions(code: string | undefined, status?: IngestionStatus, operation?: IngestionOperation) {
  const queryClient = useQueryClient();
  const observed = useRef<{ code?: string; terminal: Set<string>; activeOperationId?: string }>({ terminal: new Set() });
  useEffect(() => {
    if (observed.current.code !== code) observed.current = { code, terminal: new Set() };
    if (!code || (!status && !operation)) return;
    const keys = terminalIngestionKeys(status, operation);
    let changed = false;
    for (const key of keys) {
      if (!observed.current.terminal.has(key)) {
        observed.current.terminal.add(key);
        changed = true;
      }
    }
    if (status) {
      // The aggregate status removes a completed group. Refresh its exact cached status too.
      if (observed.current.activeOperationId && observed.current.activeOperationId !== status.activeOperation?.operationId) {
        changed = true;
      }
      observed.current.activeOperationId = status.activeOperation?.operationId;
    }
    if (changed) void invalidateIngestionViews(queryClient, code);
  }, [code, status, operation, queryClient]);
}

function useIngestionStatus(code: string | undefined, options?: IngestionPollingOptions, pipeline?: IngestionPipeline) {
  const query = useQuery<IngestionStatus>({
    queryKey: pipeline ? ingestionKeys.pipeline(code, pipeline) : ingestionKeys.status(code),
    queryFn: () => getProjectIngestion(code!),
    enabled: Boolean(code),
    refetchOnMount: 'always',
    refetchInterval: query => {
      // Required operation polling also covers a gap with no active run.
      if (isIngestionActive(query.state.data)) return 2000;
      const interval = options?.refetchInterval;
      return typeof interval === 'function' ? interval(query) : interval ?? false;
    },
  });
  useIngestionTransitions(code, query.data);
  return query;
}

export function useProjectIngestion(code: string | undefined, options?: IngestionPollingOptions) {
  return useIngestionStatus(code, options);
}

export function usePipelineIngestion(code: string | undefined, pipeline: IngestionPipeline) {
  const query = useIngestionStatus(code, undefined, pipeline);
  return { ...query, data: query.data?.pipelines?.[pipeline] };
}

export function useIngestionOperation(code: string | undefined, operationId: string | undefined) {
  const query = useQuery<IngestionOperation>({
    queryKey: ingestionKeys.operation(code, operationId),
    queryFn: () => getIngestionOperation(code!, operationId!),
    enabled: Boolean(code && operationId),
    refetchOnMount: 'always',
    refetchInterval: query => isOperationActive(query.state.data) ? 2000 : false,
  });
  useIngestionTransitions(code, undefined, query.data);
  return query;
}

export function useTriggerPipelineIngest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, input, requestKey }: { code: string; input: PipelineIngestRequest; requestKey?: string }) =>
      triggerPipelineIngest(code, input, requestKey),
    retry: false,
    onSettled: (_receipt, _error, { code }) => invalidateIngestionViews(queryClient, code),
  });
}

export function useRetryPipelineIngest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, operationId, input, requestKey }: {
      code: string; operationId: string; input: PipelineRetryRequest; requestKey?: string;
    }) => retryPipelineIngest(code, operationId, input, requestKey),
    retry: false,
    onSettled: (_receipt, _error, { code }) => invalidateIngestionViews(queryClient, code),
  });
}

export function useCancelIngestionOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, operationId }: { code: string; operationId: string }) => cancelIngestionOperation(code, operationId),
    onSuccess: (operation, { code, operationId }) => {
      queryClient.setQueryData(ingestionKeys.operation(code, operationId), operation);
    },
    onSettled: (_operation, _error, { code }) => invalidateIngestionViews(queryClient, code),
  });
}

export function useCancelIngestionRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, runId }: { code: string; runId: string }) => cancelIngestionRun(code, runId),
    onSettled: (_run, _error, { code }) => invalidateIngestionViews(queryClient, code),
  });
}
