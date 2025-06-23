import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAdminAnalysisRequestDetails } from '../api/adminRequests';
import type { AnalysisRequest } from '../../../types/index';

export const useAdminRequestDetails = () => {
  const { t } = useTranslation();
  const [requestDetailsCache, setRequestDetailsCache] = useState<Record<number, AnalysisRequest>>({});
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<AnalysisRequest | null>(null);
  const [detailDrawerRequestId, setDetailDrawerRequestId] = useState<number | null>(null);
  const [deletedRequestIdForDetailView, setDeletedRequestIdForDetailView] = useState<number | null>(null);
  
  const selectedRequestDetailsRef = useRef<AnalysisRequest | null>(null);

  useEffect(() => {
    selectedRequestDetailsRef.current = selectedRequestDetails;
  }, [selectedRequestDetails]);

  const resetDeletedRequestId = useCallback(() => {
    setDeletedRequestIdForDetailView(null);
  }, []);

  const handleCloseRequestDetails = useCallback(() => {
    setDetailDrawerRequestId(null);
    setSelectedRequestDetails(null);
  }, []);

  const handleOpenRequestDetails = useCallback(async (requestId: number) => {
    setDetailDrawerRequestId(requestId);

    if (requestDetailsCache[requestId]) {
      setSelectedRequestDetails(requestDetailsCache[requestId]);
    } else {
      setSelectedRequestDetails(null);
      try {
        const details = await getAdminAnalysisRequestDetails(requestId);
        setSelectedRequestDetails(details);
        setRequestDetailsCache((prev) => ({ ...prev, [requestId]: details }));
      } catch (error) {
        message.error(t('adminLayout.loadDetailsError', { id: requestId }));
      }
    }
  }, [requestDetailsCache, t]);

  const updateSelectedRequestDetails = useCallback(async (requestId: number, partialUpdate: Partial<AnalysisRequest>) => {
    const currentSelectedDetails = selectedRequestDetailsRef.current;

    if (currentSelectedDetails && currentSelectedDetails.id === requestId) {
      // Immediate partial update
      setSelectedRequestDetails((prevDetails) => {
        if (prevDetails && prevDetails.id === requestId) {
          return { ...prevDetails, ...partialUpdate };
        }
        return prevDetails;
      });

      // Asynchronous full refetch
      try {
        const fullDetails = await getAdminAnalysisRequestDetails(requestId);
        setSelectedRequestDetails(fullDetails);
        setRequestDetailsCache((prev) => ({ ...prev, [requestId]: fullDetails }));
      } catch (error) {
        message.error(t('adminLayout.refreshDetailsError', { id: requestId }));
      }
    }
  }, [t]);

  const handleRequestDeleted = useCallback((deletedId: number) => {
    if (detailDrawerRequestId === deletedId) {
      handleCloseRequestDetails();
    }
    if (deletedRequestIdForDetailView === deletedId) {
      setDeletedRequestIdForDetailView(null);
    }
    
    setRequestDetailsCache((prev) => {
      const newCache = { ...prev };
      delete newCache[deletedId];
      return newCache;
    });
  }, [detailDrawerRequestId, deletedRequestIdForDetailView, handleCloseRequestDetails]);

  return {
    requestDetailsCache,
    selectedRequestDetails,
    detailDrawerRequestId,
    deletedRequestIdForDetailView,
    selectedRequestDetailsRef,
    resetDeletedRequestId,
    handleCloseRequestDetails,
    handleOpenRequestDetails,
    updateSelectedRequestDetails,
    handleRequestDeleted,
  };
};