import React, { useEffect, useCallback } from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { adminApiClient as apiClient } from '@/api/centralized';

// Import custom hooks
import { useAdminRequests } from '../hooks/useAdminRequests';
import { useAdminRequestDetails } from '../hooks/useAdminRequestDetails';
import { useAdminWebSocket } from '../hooks/useAdminWebSocket';
import { useAdminNavigation } from '../hooks/useAdminNavigation';

// Import components
import AdminHeader from '../components/AdminHeader';
import AdminSidebar from '../components/AdminSidebar';
import RequestDetailDrawer from '../../../components/shared/RequestDetailDrawer';

const { Content } = Layout;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Custom hooks for state management
  const {
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
  } = useAdminRequests();

  const {
    requestDetailsCache,
    selectedRequestDetails,
    detailDrawerRequestId,
    deletedRequestIdForDetailView,
    resetDeletedRequestId,
    handleCloseRequestDetails,
    handleOpenRequestDetails,
    updateSelectedRequestDetails,
    handleRequestDeleted,
  } = useAdminRequestDetails();

  const {
    menuItems,
    getCurrentPathKeys,
    getBreadcrumbItems,
    handleUserMenuClick,
    userMenuItems,
    username,
  } = useAdminNavigation();

  // Memoize WebSocket callbacks to prevent reconnection on every render
  const handleWsRequestDeleted = useCallback((deletedId: number) => {
    removeRequest(deletedId);
    handleRequestDeleted(deletedId);
  }, [removeRequest, handleRequestDeleted]);

  // Setup WebSocket connection with memoized callbacks
  useAdminWebSocket({
    onRequestCreated: addRequest,
    onRequestUpdated: updateRequest,
    onRequestDeleted: handleWsRequestDeleted,
    onSelectedRequestUpdated: updateSelectedRequestDetails,
  });

  // Fetch initial data when component mounts
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { selectedKey, openKey } = getCurrentPathKeys();
  const breadcrumbItems = getBreadcrumbItems();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AdminSidebar
        menuItems={menuItems}
        selectedKey={selectedKey}
        openKeys={openKey}
        onMenuClick={(key) => window.location.pathname = key}
      />
      
      <Layout>
        <AdminHeader
          breadcrumbItems={breadcrumbItems}
          userMenuItems={userMenuItems}
          username={username}
          onUserMenuClick={handleUserMenuClick}
        />
        
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          <div style={{ 
            padding: 24, 
            background: colorBgContainer, 
            borderRadius: borderRadiusLG, 
            minHeight: 'calc(100vh - 64px - 48px - 69px)' 
          }}>
            <Outlet context={{
              requests,
              loadingRequests,
              fetchData,
              deletedRequestIdForDetailView,
              resetDeletedRequestId,
              requestDetailsCache,
              selectedRequestDetails,
              detailDrawerRequestId,
              handleOpenRequestDetails,
              handleCloseRequestDetails,
              currentPage,
              pageSize,
              totalRequests,
              handlePageChange,
            }} />
          </div>
        </Content>
      </Layout>
      
      <RequestDetailDrawer
        open={detailDrawerRequestId !== null}
        onClose={handleCloseRequestDetails}
        requestData={selectedRequestDetails}
        isLoading={detailDrawerRequestId !== null && selectedRequestDetails === null}
        apiClient={apiClient}
      />
    </Layout>
  );
};

export default MainLayout;