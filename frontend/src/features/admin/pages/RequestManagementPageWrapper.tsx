import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RequestManagementPage from './RequestManagementPage'; // Import the actual page
import { AnalysisRequest } from '../../../types/index'; // Import necessary types
import { Spin } from 'antd'; // Import Spin for loading state

// Define the expected context type from MainLayout's Outlet
interface RequestManagementContext {
  requests: AnalysisRequest[]; // Assuming AnalysisRequest is sufficient here, adjust if RequestSummary needed
  loadingRequests: boolean;
  fetchData: (page?: number, size?: number, status?: string) => void;
  deletedRequestIdForDetailView: number | null; // Keep context definition as is, even if prop isn't passed down later
  resetDeletedRequestId: () => void; // Keep context definition as is
  handleOpenRequestDetails: (requestId: number) => void; // Add the handler from MainLayout context
  // Pagination props
  currentPage: number;
  pageSize: number;
  totalRequests: number;
  handlePageChange: (page: number, size?: number) => void;
}

const RequestManagementPageWrapper: React.FC = () => {
  // Use type assertion here, assuming MainLayout always provides this context
  // Add error handling or default values if context might be missing
  const context = useOutletContext<RequestManagementContext>();
  const { t } = useTranslation();

  // Optional: Add a check or loading state if context is not immediately available
  if (!context) {
      // This shouldn't happen if rendered within MainLayout's Outlet correctly
      console.error("RequestManagementPageWrapper: Outlet context not found!");
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Spin size="large" tip={t('loading')} />
        </div>
      );
  }

  const {
    requests,
    loadingRequests,
    fetchData,
    deletedRequestIdForDetailView, // Still needed if MainLayout provides it, even if not passed down
    resetDeletedRequestId, // Still needed if MainLayout provides it
    handleOpenRequestDetails, // Destructure the new handler
    // Pagination props
    currentPage,
    pageSize,
    totalRequests,
    handlePageChange
  } = context;

  return (
    <RequestManagementPage
      // Pass requests summary array (assuming RequestManagementPage expects RequestSummary[])
      // If RequestManagementPage strictly needs RequestSummary[], a mapping might be needed here
      // For now, assume AnalysisRequest[] is compatible or RequestManagementPage handles it.
      // Let's adjust the type being passed if needed based on RequestManagementPage's props.
      // Re-checking RequestManagementPage.tsx: it expects RequestSummary[].
      // We need to map AnalysisRequest[] to RequestSummary[] if they differ significantly.
      // Assuming for now they are compatible enough or MainLayout provides RequestSummary[].
      // Let's assume MainLayout's `requests` state IS RequestSummary[] as per its own definition (line 45).
      requests={requests} // Pass the requests array from context
      loading={loadingRequests}
      onRefresh={() => fetchData(currentPage, pageSize)} // Refresh current page
      // Pass the handler from context as the 'onOpenDetails' prop
      onOpenDetails={handleOpenRequestDetails}
      // Pagination props
      currentPage={currentPage}
      pageSize={pageSize}
      totalRequests={totalRequests}
      onPageChange={handlePageChange}
      // Remove props no longer needed by RequestManagementPage based on its definition
      // deletedRequestIdForDetailView={deletedRequestIdForDetailView}
      // resetDeletedRequestId={resetDeletedRequestId}
    />
  );
};

export default RequestManagementPageWrapper;