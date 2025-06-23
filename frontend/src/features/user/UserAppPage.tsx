import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import { Layout, theme, Typography, message, Spin, Tag, Tooltip, Row, Col, Space } from 'antd';
import { WifiOutlined, LoadingOutlined, WarningOutlined, ApiOutlined } from '@ant-design/icons';

import { getAnalysisRequests, getAnalysisRequestDetails } from './api/requests';
import { checkInitializationStatus } from './api/initialize';
import { useWebSocket, apiClient } from './lib/communication';

const { Header, Content } = Layout;
const { Title } = Typography;

import SubmissionForm from './components/SubmissionForm';
import RequestList from './components/RequestList';
import type { AnalysisRequest, RequestSummary } from '../../../shared/src/types/index';
import RequestDetailDrawer from '../../components/shared/RequestDetailDrawer';
import InitializationPage from './components/InitializationPage';
import ThemeSwitcher from '../../components/shared/ThemeSwitcher';
import LanguageSwitcher from '../../components/shared/LanguageSwitcher';

type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

function UserAppPage() {
  const { t } = useTranslation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [wsStatus, setWsStatus] = useState<WebSocketConnectionStatus>('disconnected');
  const [analysisRequests, setAnalysisRequests] = useState<RequestSummary[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AnalysisRequest | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requestDetailsCache, setRequestDetailsCache] = useState<Record<number, AnalysisRequest>>({});
  const selectedRequestRef = useRef(selectedRequest);
  
  const fetchRequests = useCallback(async () => {
    if (isInitialized !== true) return;

    setLoadingRequests(true);
    try {
      const fetchedRequests = await getAnalysisRequests(undefined, 0, 100);
      setAnalysisRequests(fetchedRequests);
    } catch (error) {
      message.error(t('app.fetchRequestsError'));
      console.error("Fetch requests error:", error);
    } finally {
      setLoadingRequests(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const status = await checkInitializationStatus();
        setIsInitialized(status.initialized);
      } catch (error) {
        message.error(t('app.checkStatusError'));
        setIsInitialized(null);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

   useEffect(() => {
    if (isInitialized === true) {
       fetchRequests();
    }
   }, [isInitialized, fetchRequests]);

   useEffect(() => {
     selectedRequestRef.current = selectedRequest;
   }, [selectedRequest]);

  const handleRequestSelect = async (requestSummary: RequestSummary) => {
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
      setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => ({
        ...prevCache,
        [requestId]: fullRequestDetails
      }));
    } catch (error) {
      message.error(t('app.fetchDetailsError', { id: requestId }));
      console.error("Fetch request details error:", error);
      setIsModalOpen(false);
      setSelectedRequest(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmissionSuccess = () => {
    // Will be updated via WebSocket
  };

  const handleRegenerationSuccess = (newRequest: AnalysisRequest) => {
      setIsModalOpen(false);
      setSelectedRequest(null);
      message.success(t('app.regenerationSuccess', { id: newRequest.id }));
  };

  const webSocketHook = useWebSocket;
  const wsConnectedRef = useRef(false);

  useEffect(() => {
    if (isInitialized !== true) {
        if (wsConnectedRef.current) {
            webSocketHook.disconnect();
            wsConnectedRef.current = false;
        }
        return;
    }

    const connectWebSocket = () => {
      if (wsConnectedRef.current) {
        return;
      }
      
      const cleanupHandlers = [
        webSocketHook.on('connection_established', () => {
          setWsStatus('connected');
          wsConnectedRef.current = true;
        }),
        
        webSocketHook.on('connection_lost', () => {
          setWsStatus('disconnected');
          wsConnectedRef.current = false;
        }),
        
        webSocketHook.on('error', () => {
          setWsStatus('error');
        }),

        webSocketHook.on('request_created', (event) => {
          const newRequestSummary = event.payload as RequestSummary;
          setAnalysisRequests((prevRequests: RequestSummary[]) => {
            if (prevRequests.some((req: RequestSummary) => req.id === newRequestSummary.id)) {
              console.warn(`[Frontend WS] Request ${newRequestSummary.id} already exists. Updating.`);
              return prevRequests.map((req: RequestSummary) =>
                req.id === newRequestSummary.id ? newRequestSummary : req
              );
            }
            return [newRequestSummary, ...prevRequests];
          });
        }),
        
        webSocketHook.on('request_updated', (event) => {
          const updatedSummary = event.payload as Partial<RequestSummary> & { id: number };
          setAnalysisRequests((prevRequests: RequestSummary[]) =>
            prevRequests.map((req: RequestSummary) =>
              req.id === updatedSummary.id
                ? { ...req, ...updatedSummary }
                : req
            )
          );
          
          const currentSelectedRequest = selectedRequestRef.current;
          if (currentSelectedRequest && String(currentSelectedRequest.id) === String(updatedSummary.id)) {
            setLoadingDetails(true);
            setSelectedRequest(null);
            
            setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => {
              const newCache = { ...prevCache };
              delete newCache[updatedSummary.id];
              return newCache;
            });
            
            getAnalysisRequestDetails(updatedSummary.id)
              .then((updatedDetails) => {
                setRequestDetailsCache((prevCache) => ({
                  ...prevCache,
                  [updatedSummary.id]: updatedDetails,
                }));
                setSelectedRequest(updatedDetails);
              })
              .catch((error) => {
                console.error('Error refetching updated request details:', error);
                message.error(t('app.errorFetchingDetails'));
              })
              .finally(() => {
                setLoadingDetails(false);
              });
          }
        }),
        
        webSocketHook.on('request_deleted', (event) => {
          const deletedId = event.payload.id;
          setAnalysisRequests((prevRequests: RequestSummary[]) =>
            prevRequests.filter((req: RequestSummary) => req.id !== deletedId)
          );
          
          const currentSelectedRequest = selectedRequestRef.current;
          if (currentSelectedRequest && currentSelectedRequest.id === deletedId) {
            setIsModalOpen(false);
            setSelectedRequest(null);
            message.info(t('app.requestDeleted'));
          }
        }),
      ];
      
      webSocketHook.connect();
      
      return cleanupHandlers;
    };

    const cleanupHandlers = connectWebSocket();

    return () => {
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
      }
      
      if (cleanupHandlers) {
        cleanupHandlers.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      }
    };
  }, [isInitialized]);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

   const handleInitializationSuccess = () => {
      setIsInitialized(true);
      setCheckingStatus(false);
      fetchRequests();
      message.success(t('app.initializationSuccess'));
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
      <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
         <Title level={3} style={{ margin: 0, flexGrow: 1, textAlign: 'center', color: '#fff' }}>{t('app.title')}</Title>
         <Space>
             <LanguageSwitcher />
             <ThemeSwitcher />
             <Tooltip title={t('app.websocketStatusTooltip', { status: wsStatus })}>
                  <Tag icon={
                      wsStatus === 'connected' ? <WifiOutlined /> :
                      wsStatus === 'connecting' ? <LoadingOutlined spin /> :
                      wsStatus === 'error' ? <WarningOutlined /> :
                      <ApiOutlined />
                  } color={
                      wsStatus === 'connected' ? 'success' :
                      wsStatus === 'connecting' ? 'processing' :
                      wsStatus === 'error' ? 'error' :
                      'default'
                  }>
                      {t(`app.websocketStatus.${wsStatus}`)}
                  </Tag>
             </Tooltip>
         </Space>
      </Header>

      <Content style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
        <Row gutter={[16, 16]} style={{ height: '100%' }}>
          <Col xs={24} sm={24} md={24} lg={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', background: colorBgContainer, borderRadius: borderRadiusLG, padding: '12px' }}>
              <RequestList
                  requests={analysisRequests}
                  loading={loadingRequests}
                  selectedRequestId={selectedRequest?.id ?? null}
                  onSelectRequest={handleRequestSelect}
                  onRefresh={fetchRequests}
              />
            </div>
          </Col>

          <Col xs={24} sm={24} md={24} lg={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
             <div
                style={{
                  flex: 1,
                  padding: 24,
                  background: colorBgContainer,
                  borderRadius: borderRadiusLG,
                  overflowY: 'auto'
                }}
              >
                <SubmissionForm onSubmissionSuccess={handleSubmissionSuccess} />
              </div>
          </Col>
        </Row>
      </Content>

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