import { useQuery } from '@tanstack/react-query';
import {
  getCapabilities,
  getSystemHealth,
  type CapabilitiesReport,
  type SystemHealthReport,
} from '@/services/api';

export function useCapabilities() {
  return useQuery<CapabilitiesReport>({
    queryKey: ['capabilities'],
    queryFn: getCapabilities,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useSystemHealth(options?: {
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  return useQuery<SystemHealthReport>({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : 10000,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
