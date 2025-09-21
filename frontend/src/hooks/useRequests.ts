import { useState, useEffect, useCallback } from 'react';
import { getAnalysisRequests } from '@/features/user/api/requests';
import type { RequestSummary, RequestStatus } from '@shared/types';

const normalizeStatus = (status: RequestStatus | string): RequestStatus => {
  const normalized = status.toString().toLowerCase();

  switch (normalized) {
    case 'queued':
    case 'pending':
      return 'Queued';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Queued';
  }
};

const transformToRequestSummary = (summary: RequestSummary): RequestSummary => ({
  ...summary,
  status: normalizeStatus(summary.status),
  error_message: summary.error_message ?? null,
});

export const useRequests = () => {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalysisRequests();
      setRequests(data.map(transformToRequestSummary));
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
