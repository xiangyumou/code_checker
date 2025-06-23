import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAnalysisRequests } from '../api/requests';
import type { RequestSummary } from '../../../types/index';

export const useAnalysisRequests = (isInitialized: boolean | null) => {
  const { t } = useTranslation();
  const [analysisRequests, setAnalysisRequests] = useState<RequestSummary[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (isInitialized !== true) return;

    setLoadingRequests(true);
    try {
      const fetchedRequests = await getAnalysisRequests(undefined, 0, 100);
      setAnalysisRequests(fetchedRequests);
    } catch (error) {
      message.error(t('app.fetchRequestsError'));
    } finally {
      setLoadingRequests(false);
    }
  }, [isInitialized, t]);

  const updateRequest = useCallback((updatedSummary: Partial<RequestSummary> & { id: number }) => {
    setAnalysisRequests((prevRequests) =>
      prevRequests.map((req) =>
        req.id === updatedSummary.id
          ? { ...req, ...updatedSummary }
          : req
      )
    );
  }, []);

  const addRequest = useCallback((newRequestSummary: RequestSummary) => {
    setAnalysisRequests((prevRequests) => {
      if (prevRequests.some((req) => req.id === newRequestSummary.id)) {
        return prevRequests.map((req) =>
          req.id === newRequestSummary.id ? newRequestSummary : req
        );
      }
      return [newRequestSummary, ...prevRequests];
    });
  }, []);

  const removeRequest = useCallback((deletedId: number) => {
    setAnalysisRequests((prevRequests) =>
      prevRequests.filter((req) => req.id !== deletedId)
    );
  }, []);

  return {
    analysisRequests,
    loadingRequests,
    fetchRequests,
    updateRequest,
    addRequest,
    removeRequest,
  };
};