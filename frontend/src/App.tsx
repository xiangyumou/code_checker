import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Added Tag and icons for WebSocket status
// Import Row and Col for responsive grid layout
import { Layout, theme, Typography, message, Spin, Tag, Tooltip, Row, Col, Space } from 'antd'; // Added Row, Col, Space
import { WifiOutlined, LoadingOutlined, WarningOutlined, ApiOutlined } from '@ant-design/icons';
// Removed ResizableBox and CSS imports
// Removed App.css import

// Import API functions and communication setup
import { getAnalysisRequests, getAnalysisRequestDetails } from './api/requests';
import { checkInitializationStatus } from './api/initialize';
import { useWebSocket } from './lib/communication';

const { Header, Content, Footer } = Layout; // Removed Sider import
const { Title } = Typography;

// Import components
import SubmissionForm from './components/SubmissionForm';
import RequestList from './components/RequestList';
// Use AnalysisRequest and RequestSummary types from shared library
import type { AnalysisRequest, RequestSummary } from '../../shared/src/types/index';
import RequestDetailDrawer from './components/RequestDetailDrawer'; // Import the new Drawer component
import InitializationPage from './components/InitializationPage'; // Import InitializationPage
import ThemeSwitcher from './components/ThemeSwitcher'; // Import ThemeSwitcher
import LanguageSwitcher from './components/LanguageSwitcher'; // Import LanguageSwitcher

// Define WebSocket status type
type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

function App() {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // State for initialization status
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null); // null = checking, false = not initialized, true = initialized
  const [checkingStatus, setCheckingStatus] = useState(true);

  // State for WebSocket connection status
  const [wsStatus, setWsStatus] = useState<WebSocketConnectionStatus>('disconnected');

  // State for request list (summaries) and loading status
  const [analysisRequests, setAnalysisRequests] = useState<RequestSummary[]>([]); // Changed name and type
  const [loadingRequests, setLoadingRequests] = useState(false);

  // State for managing the result modal visibility and data
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AnalysisRequest | null>(null); // Keep as AnalysisRequest for details
  const [loadingDetails, setLoadingDetails] = useState(false); // Add state for loading details
  const [requestDetailsCache, setRequestDetailsCache] = useState<Record<number, AnalysisRequest>>({}); // Cache for full details

  // Ref to hold the current selected request to avoid closure issues in WebSocket handler
  const selectedRequestRef = useRef(selectedRequest);

  // Removed panelWidth state
  
  // Function to fetch requests
  const fetchRequests = useCallback(async () => {
    // Only fetch if initialized
    if (isInitialized !== true) return;

    setLoadingRequests(true);
    try {
      const fetchedRequests = await getAnalysisRequests(undefined, 0, 100); // Fetches RequestSummary[] now
      setAnalysisRequests(fetchedRequests); // Update state with summaries
    } catch (error) {
      message.error(t('app.fetchRequestsError')); // Define new key
      console.error("Fetch requests error:", error);
    } finally {
      setLoadingRequests(false);
    }
  }, [isInitialized]); // Depend on isInitialized

  // Check initialization status on initial mount
  useEffect(() => {
    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const status = await checkInitializationStatus();
        setIsInitialized(status.initialized);
        // No need to call fetchRequests here, the other useEffect will handle it
      } catch (error) {
        message.error(t('app.checkStatusError')); // Define new key
        setIsInitialized(null); // Indicate error state
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []); // Run only once on mount

   // Fetch requests when isInitialized becomes true
   useEffect(() => {
    if (isInitialized === true) {
       fetchRequests();
    }
   }, [isInitialized, fetchRequests]);

   // Effect to keep the ref updated with the latest selectedRequest
   useEffect(() => {
     selectedRequestRef.current = selectedRequest;
     // console.log('[Ref Update Effect] selectedRequestRef.current updated:', selectedRequestRef.current?.id); // Removed log
   }, [selectedRequest]);


   // Handler for selecting a request from the list - implements on-demand loading with cache
  const handleRequestSelect = async (requestSummary: RequestSummary) => { // Accepts RequestSummary now
    const requestId = requestSummary.id;
    // console.log(`Selected Request ID: ${requestId}`); // Removed log

    // Check cache first
    if (requestDetailsCache[requestId]) {
      // console.log(`Cache hit for request ID: ${requestId}`); // Removed log
      setSelectedRequest(requestDetailsCache[requestId]);
      setIsModalOpen(true);
      setLoadingDetails(false); // Ensure loading is false if cache hit
      return; // Exit early
    }

    // Not in cache, proceed to fetch
    // console.log(`Cache miss for request ID: ${requestId}. Fetching details...`); // Removed log
    setLoadingDetails(true);
    setSelectedRequest(null); // Clear previous selection while loading new one
    setIsModalOpen(true); // Open the drawer immediately to show loading state

    try {
      const fullRequestDetails = await getAnalysisRequestDetails(requestId);
      // console.log("Fetched Full Request Details:", fullRequestDetails); // Removed log
      setSelectedRequest(fullRequestDetails); // Set the complete data
      // Update cache
      setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => ({ // Add type annotation
        ...prevCache,
        [requestId]: fullRequestDetails
      }));
    } catch (error) {
      message.error(t('app.fetchDetailsError', { id: requestId })); // Use requestId
      console.error("Fetch request details error:", error);
      setIsModalOpen(false); // Close modal on error fetching details
      setSelectedRequest(null); // Clear selection on error
    } finally {
      setLoadingDetails(false); // Indicate loading finished
    }
  };

  // Handler for successful submission from the form
  const handleSubmissionSuccess = () => {
    // No longer need to fetch requests here.
    // The list will be updated via WebSocket 'request_created' message.
    // console.log("Submission successful. Waiting for WebSocket update for the new request."); // Removed log
    // TODO: Maybe show a temporary "Processing..." indicator or message?
  };

  // Handler for successful regeneration (which now creates a NEW request)
  const handleRegenerationSuccess = (newRequest: AnalysisRequest) => {
      // No longer need to manually add the request here.
      // The list will be updated via WebSocket 'request_created' message for the *new* request ID.
      // console.log(`Regeneration successful. New request ${newRequest.id} created. Waiting for WebSocket update.`); // Removed log
      // Close the modal after successful regeneration
      setIsModalOpen(false);
      // Optionally clear the selection or select the new one
      setSelectedRequest(null); // Clear selection for simplicity
      message.success(t('app.regenerationSuccess', { id: newRequest.id })); // Define new key
  };

  // --- WebSocket Logic (Updated to use unified manager) ---
  const webSocketHook = useWebSocket;
  const wsConnectedRef = useRef(false);

  useEffect(() => {
    // Only connect WebSocket if initialized
    if (isInitialized !== true) {
        // Cleanup connection if status changes back to uninitialized
        if (wsConnectedRef.current) {
            webSocketHook.disconnect();
            wsConnectedRef.current = false;
        }
        return;
    }

    // Function to establish WebSocket connection using unified manager
    const connectWebSocket = () => {
      if (wsConnectedRef.current) {
        return; // Already connected
      }
      
      // Set up event handlers
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
            // Avoid adding duplicates
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
          
          // Update selected request if necessary
          const currentSelectedRequest = selectedRequestRef.current;
          if (currentSelectedRequest && String(currentSelectedRequest.id) === String(updatedSummary.id)) {
            setLoadingDetails(true);
            setSelectedRequest(null);
            
            // Invalidate cache
            setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => {
              const newCache = { ...prevCache };
              delete newCache[updatedSummary.id];
              return newCache;
            });
            
            // Refetch details
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
          
          // Close modal if deleted request was selected
          const currentSelectedRequest = selectedRequestRef.current;
          if (currentSelectedRequest && currentSelectedRequest.id === deletedId) {
            setIsModalOpen(false);
            setSelectedRequest(null);
            message.info(t('app.requestDeleted'));
          }
        }),
      ];
      
      // Connect WebSocket
      webSocketHook.connect();
      
      return cleanupHandlers;
    };

    // Set up WebSocket connection
    const cleanupHandlers = connectWebSocket();

    // Cleanup function to disconnect WebSocket and remove event handlers
    return () => {
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
      }
      
      // Clean up event handlers
      if (cleanupHandlers) {
        cleanupHandlers.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      }
    };
  }, [isInitialized]); // Re-run effect if initialization status changes

  // --- End WebSocket Logic ---


  const handleModalClose = () => {
    setIsModalOpen(false);
    // Delay setting selectedRequest to null to allow modal fade-out animation
    // setTimeout(() => setSelectedRequest(null), 300);
  };

   // Handler for successful initialization from InitializationPage
   const handleInitializationSuccess = () => {
      setIsInitialized(true);
      setCheckingStatus(false);
      // Fetch initial requests now that we are initialized
      fetchRequests();
      message.success(t('app.initializationSuccess')); // Define new key
  };
  
  // Removed handleResize callback
  
  
  // --- Render Logic ---
  
  // Show loading spinner while checking status
  if (checkingStatus || isInitialized === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        {/* Removed tip as it causes warning when Spin is not nested */}
        <Spin size="large" />
      </div>
    );
  }

  // Show initialization page if not initialized
  if (!isInitialized) {
    return <InitializationPage onInitializationSuccess={handleInitializationSuccess} />;
  }

  // Render main application layout if initialized
  return (
    // Root Layout: Column direction, full viewport height
    <Layout style={{ height: '100vh', flexDirection: 'column' }}>
      {/* Global Header */}
      <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 /* Prevent header shrinking */ }}>
         <Title level={3} style={{ margin: 0, flexGrow: 1, textAlign: 'center', color: '#fff' /* Assuming default dark header */ }}>{t('app.title')}</Title> {/* Define new key */}
         {/* Right side controls: Language Switcher, Theme Switcher and WebSocket Status */}
         <Space>
             <LanguageSwitcher /> {/* Add the language switcher */}
             <ThemeSwitcher /> {/* Add the theme switcher */}
             {/* Use t() for Tooltip title and Tag content */}
             <Tooltip title={t('app.websocketStatusTooltip', { status: wsStatus })}> {/* Define new key */}
                  <Tag icon={
                      wsStatus === 'connected' ? <WifiOutlined /> :
                      wsStatus === 'connecting' ? <LoadingOutlined spin /> :
                      wsStatus === 'error' ? <WarningOutlined /> :
                      <ApiOutlined /> // disconnected
                  } color={
                      wsStatus === 'connected' ? 'success' :
                      wsStatus === 'connecting' ? 'processing' :
                      wsStatus === 'error' ? 'error' :
                      'default' // disconnected
                  }>
                      {t(`app.websocketStatus.${wsStatus}`)} {/* Define nested keys */}
                  </Tag>
             </Tooltip>
             {/* ThemeSwitcher moved next to LanguageSwitcher */}
         </Space>
      </Header>

      {/* Main Content Area (takes remaining height) */}
      {/* Use Content component directly under the main Layout */}
      <Content style={{ flex: 1, overflow: 'hidden', padding: '16px' /* Add padding around the Row */ }}>
        {/* Responsive Row with gutter for spacing */}
        <Row gutter={[16, 16]} style={{ height: '100%' }}>
          {/* Left Column: Request List (Responsive) */}
          <Col xs={24} sm={24} md={24} lg={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Wrapper div for RequestList to handle scrolling */}
            <div style={{ flex: 1, overflowY: 'auto', background: colorBgContainer, borderRadius: borderRadiusLG, padding: '12px' /* Inner padding */ }}>
              <RequestList
                  requests={analysisRequests} // Pass summaries
                  loading={loadingRequests}
                  selectedRequestId={selectedRequest?.id ?? null} // Pass selected ID for highlighting
                  onSelectRequest={handleRequestSelect} // Pass the updated handler
                  onRefresh={fetchRequests}
              />
            </div>
          </Col>

          {/* Right Column: Submission Form (Responsive) */}
          <Col xs={24} sm={24} md={24} lg={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
             {/* Wrapper div for SubmissionForm */}
             <div
                style={{
                  flex: 1, // Take available space
                  padding: 24,
                  background: colorBgContainer,
                  borderRadius: borderRadiusLG,
                  overflowY: 'auto' // Allow form content to scroll if needed
                }}
              >
                <SubmissionForm onSubmissionSuccess={handleSubmissionSuccess} />
              </div>
          </Col>
        </Row>
      </Content>

      {/* Global Footer - Removed as per user request */}
      {/*
      <Footer style={{ textAlign: 'center', padding: '12px 50px', flexShrink: 0 }}>
        {t('app.footer', { year: new Date().getFullYear() })}
      </Footer>
      */}

      {/* Render the Request Detail Drawer (keep outside main layout) */}
      <RequestDetailDrawer
        open={isModalOpen} // Changed prop name from isOpen to open
        onClose={handleModalClose}
        requestData={selectedRequest} // Pass the potentially null or full request data
        isLoading={loadingDetails} // Pass loading state to drawer
        onRegenerateSuccess={handleRegenerationSuccess} // Pass the handler
      />
    </Layout>
  );
}

export default App;
