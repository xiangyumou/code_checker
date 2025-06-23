import { useState, useCallback, useRef } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAdminAnalysisRequests } from '../api/adminRequests';
import type { RequestSummary, RequestStatus } from '../../../types/index';

export const useAdminRequests = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRequests, setTotalRequests] = useState(0);
  
  // Use refs to store current values to avoid recreating fetchData
  const currentPageRef = useRef(currentPage);
  const pageSizeRef = useRef(pageSize);
  
  // Update refs when state changes
  currentPageRef.current = currentPage;
  pageSizeRef.current = pageSize;

  const fetchData = useCallback(async (page?: number, size?: number, status?: RequestStatus) => {
    setLoadingRequests(true);
    try {
      const actualPage = page ?? currentPageRef.current;
      const actualSize = size ?? pageSizeRef.current;
      const skip = (actualPage - 1) * actualSize;
      const fetchedRequests = await getAdminAnalysisRequests(status, skip, actualSize);
      setRequests(fetchedRequests);
      
      if (fetchedRequests.length < actualSize) {
        setTotalRequests((actualPage - 1) * actualSize + fetchedRequests.length);
      } else {
        setTotalRequests(actualPage * actualSize + 1);
      }
    } catch (error) {
      message.error(t('adminRequests.fetchError'));
    } finally {
      setLoadingRequests(false);
    }
  }, [message, t]);

  const handlePageChange = useCallback((page: number, size?: number) => {
    setCurrentPage(page);
    if (size && size !== pageSize) {
      setPageSize(size);
    }
    fetchData(page, size || pageSize);
  }, [fetchData, pageSize]);

  const updateRequest = useCallback((updatedSummary: Partial<RequestSummary> & { id: number }) => {
    setRequests((prevRequests) =>
      prevRequests.map((req) =>
        req.id === updatedSummary.id
          ? { ...req, ...updatedSummary }
          : req
      )
    );
  }, []);

  const addRequest = useCallback((newRequestSummary: RequestSummary) => {
    setRequests((prevRequests) => {
      if (prevRequests.some((req) => req.id === newRequestSummary.id)) {
        return prevRequests.map((req) =>
          req.id === newRequestSummary.id ? newRequestSummary : req
        );
      }
      return [newRequestSummary, ...prevRequests];
    });
  }, []);

  const removeRequest = useCallback((deletedId: number) => {
    setRequests((prevRequests) =>
      prevRequests.filter((req) => req.id !== deletedId)
    );
  }, []);

  return {
    requests,
    loadingRequests,
    currentPage,
    pageSize,
    totalRequests,
    fetchData,
    handlePageChange,
    updateRequest,
    addRequest,
    removeRequest,
  };
};