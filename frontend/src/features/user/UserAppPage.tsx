import React, { useEffect, useCallback } from 'react';
import { Layout, Spin } from 'antd';
import { apiClient } from './lib/communication';

// Import custom hooks
import { useAppInitialization } from './hooks/useAppInitialization';
import { useAnalysisRequests } from './hooks/useAnalysisRequests';
import { useRequestDetails } from './hooks/useRequestDetails';
import { useWebSocketConnection } from './hooks/useWebSocketConnection';

// Import components
import AppHeader from './components/AppHeader';
import MainContent from './components/MainContent';
import RequestDetailDrawer from '../../components/shared/RequestDetailDrawer';
import InitializationPage from './components/InitializationPage';

function UserAppPage() {
  // Custom hooks for state management
  const { isInitialized, checkingStatus, handleInitializationSuccess } = useAppInitialization();
  
  const {
    analysisRequests,
    loadingRequests,
    fetchRequests,
    updateRequest,
    addRequest,
    removeRequest,
  } = useAnalysisRequests(isInitialized);

  const {
    isModalOpen,
    selectedRequest,
    loadingDetails,
    handleRequestSelect,
    handleModalClose,
    handleRegenerationSuccess,
    updateSelectedRequestDetails,
    clearSelectedRequestIfDeleted,
  } = useRequestDetails();

  // Memoize the onRequestDeleted callback to prevent WebSocket reconnection loops
  const handleRequestDeleted = useCallback((deletedId: number) => {
    removeRequest(deletedId);
    clearSelectedRequestIfDeleted(deletedId);
  }, [removeRequest, clearSelectedRequestIfDeleted]);

  const { wsStatus } = useWebSocketConnection({
    isInitialized,
    onRequestCreated: addRequest,
    onRequestUpdated: updateRequest,
    onRequestDeleted: handleRequestDeleted,
    onSelectedRequestUpdated: updateSelectedRequestDetails,
  });

  // Fetch requests when app initializes
  useEffect(() => {
    if (isInitialized === true) {
      fetchRequests();
    }
  }, [isInitialized, fetchRequests]);

  const handleSubmissionSuccess = () => {
    // Will be updated via WebSocket
  };
  
  if (checkingStatus || isInitialized === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isInitialized) {
    return <InitializationPage onInitializationSuccess={handleInitializationSuccess} />;
  }

  return (
    <Layout style={{ height: '100vh', flexDirection: 'column' }}>
      <AppHeader wsStatus={wsStatus} />
      
      <MainContent
        analysisRequests={analysisRequests}
        loadingRequests={loadingRequests}
        selectedRequest={selectedRequest}
        onSelectRequest={handleRequestSelect}
        onRefresh={fetchRequests}
        onSubmissionSuccess={handleSubmissionSuccess}
      />

      <RequestDetailDrawer
        open={isModalOpen}
        onClose={handleModalClose}
        requestData={selectedRequest}
        isLoading={loadingDetails}
        onRegenerateSuccess={handleRegenerationSuccess}
        apiClient={apiClient}
      />
    </Layout>
  );
}

export default UserAppPage;