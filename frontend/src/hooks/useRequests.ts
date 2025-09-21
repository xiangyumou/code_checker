import { useState, useEffect, useCallback } from 'react';
import { getAnalysisRequests } from '@/features/user/api/requests';
import type { RequestSummary } from '@/types/index';
import type { Request } from '@/components/user/RequestList';

const statusMap: Record<string, Request['status']> = {
  queued: 'pending',
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
};

const transformToRequest = (summary: RequestSummary): Request => ({
  id: summary.id,
  status: statusMap[summary.status.toLowerCase()] ?? 'pending',
  created_at: summary.created_at,
  updated_at: summary.updated_at,
  error_message: summary.error_message ?? undefined,
});

export const useRequests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalysisRequests();
      setRequests(data.map(transformToRequest));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch requests';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
  };
};
