import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAnalysisRequestDetails } from '../api/requests';
import type { AnalysisRequest, RequestSummary } from '../../../types/index';

export const useRequestDetails = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AnalysisRequest | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requestDetailsCache, setRequestDetailsCache] = useState<Record<number, AnalysisRequest>>({});
  const selectedRequestRef = useRef(selectedRequest);

  useEffect(() => {
    selectedRequestRef.current = selectedRequest;
  }, [selectedRequest]);

  const handleRequestSelect = useCallback(async (requestSummary: RequestSummary) => {
    const requestId = requestSummary.id;

    if (requestDetailsCache[requestId]) {
      setSelectedRequest(requestDetailsCache[requestId]);
      setIsModalOpen(true);
      setLoadingDetails(false);
      return;
    }

    setLoadingDetails(true);
    setSelectedRequest(null);
    setIsModalOpen(true);

    try {
      const fullRequestDetails = await getAnalysisRequestDetails(requestId);
      setSelectedRequest(fullRequestDetails);
      setRequestDetailsCache((prevCache) => ({
        ...prevCache,
        [requestId]: fullRequestDetails
      }));
    } catch (error) {
      message.error(t('app.fetchDetailsError', { id: requestId }));
      setIsModalOpen(false);
      setSelectedRequest(null);
    } finally {
      setLoadingDetails(false);
    }
  }, [requestDetailsCache, t]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleRegenerationSuccess = useCallback((newRequest: AnalysisRequest) => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    message.success(t('app.regenerationSuccess', { id: newRequest.id }));
  }, [t]);

  const updateSelectedRequestDetails = useCallback(async (requestId: number) => {
    if (selectedRequestRef.current && selectedRequestRef.current.id === requestId) {
      setLoadingDetails(true);
      setSelectedRequest(null);
      
      setRequestDetailsCache((prevCache) => {
        const newCache = { ...prevCache };
        delete newCache[requestId];
        return newCache;
      });
      
      try {
        const updatedDetails = await getAnalysisRequestDetails(requestId);
        setRequestDetailsCache((prevCache) => ({
          ...prevCache,
          [requestId]: updatedDetails,
        }));
        setSelectedRequest(updatedDetails);
      } catch (error) {
        message.error(t('app.errorFetchingDetails'));
      } finally {
        setLoadingDetails(false);
      }
    }
  }, [t]);

  const clearSelectedRequestIfDeleted = useCallback((deletedId: number) => {
    if (selectedRequestRef.current && selectedRequestRef.current.id === deletedId) {
      setIsModalOpen(false);
      setSelectedRequest(null);
      message.info(t('app.requestDeleted'));
    }
  }, [t]);

  return {
    isModalOpen,
    selectedRequest,
    loadingDetails,
    selectedRequestRef,
    handleRequestSelect,
    handleModalClose,
    handleRegenerationSuccess,
    updateSelectedRequestDetails,
    clearSelectedRequestIfDeleted,
  };
};