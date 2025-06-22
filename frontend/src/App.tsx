import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Added Tag and icons for WebSocket status
// Import Row and Col for responsive grid layout
import { Layout, theme, Typography, message, Spin, Tag, Tooltip, Row, Col, Space } from 'antd'; // Added Row, Col, Space
import { WifiOutlined, LoadingOutlined, WarningOutlined, ApiOutlined } from '@ant-design/icons';
// Removed ResizableBox and CSS imports
// Removed App.css import

// Import API functions
// Import getAnalysisRequestDetails as well
import { getAnalysisRequests, getAnalysisRequestDetails } from './api/requests';
import { checkInitializationStatus } from './api/initialize'; // Import initialization API

const { Header, Content, Footer } = Layout; // Removed Sider import
const { Title } = Typography;

// Import components
import SubmissionForm from './components/SubmissionForm';
import RequestList from './components/RequestList';
// Use AnalysisRequest and RequestSummary types
import { AnalysisRequest, RequestSummary } from './types';
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

  // --- WebSocket Logic ---
  const wsRef = useRef<WebSocket | null>(null); // Ref to hold WebSocket instance

  useEffect(() => {
    // console.log(`[WebSocket Effect] Running effect. isInitialized: ${isInitialized}`); // Removed log

    // Only connect WebSocket if initialized
    if (isInitialized !== true) {
        // console.log('[WebSocket Effect] Not initialized, cleaning up potential existing connection.'); // Removed log
        // Cleanup potentially existing connection if status changes back to uninitialized/error
        if (wsRef.current) {
            // console.log('[WebSocket Effect] Closing WebSocket due to initialization status change.'); // Removed log
            wsRef.current.close();
            wsRef.current = null;
        }
        return;
    }

    // Function to establish WebSocket connection
    const connectWebSocket = () => {
      // console.log('[WebSocket Effect] connectWebSocket called.'); // Removed log
      // Avoid reconnecting if already connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // console.log("[WebSocket Effect] WebSocket already connected and open. Skipping."); // Removed log
          return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          // console.log("[WebSocket Effect] WebSocket already connecting. Skipping."); // Removed log
          return;
      }


      // Generate unique client ID using uuid
      const clientId = `frontend-${uuidv4()}`;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Assuming the backend endpoint remains /ws/status/{client_id}
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/status/${clientId}`;
      // console.log("[WebSocket Effect] Attempting to connect WebSocket:", wsUrl); // Removed log

      const ws = new WebSocket(wsUrl);
      // console.log(`[WebSocket Effect] New WebSocket instance created for ${clientId}.`); // Removed log

      // Assign listeners immediately after creation
      // console.log(`[WebSocket Effect] Assigning onopen listener for ${clientId}...`); // Removed log
      ws.onopen = () => {
        // console.log(`[WebSocket Event] onopen fired for ${clientId}`); // Removed log
        // message.success('Real-time status updates connected.'); // Replaced with status indicator
        setWsStatus('connected'); // Update status state
      };

      // Define expected message structure
      interface WebSocketMessage {
        type: 'request_created' | 'request_updated' | 'request_deleted';
        payload: any; // Use 'any' for now, refine if needed based on backend schema
      }

      // console.log(`[WebSocket Effect] Assigning onmessage listener for ${clientId}...`); // Removed log
      ws.onmessage = (event) => {
        // console.log(`>>> ONMESSAGE HANDLER FIRED for ${clientId}! Raw data:`, event.data); // Removed log
        try {
          const messageData: WebSocketMessage = JSON.parse(event.data);
          // console.log('[WebSocket Event] Parsed WebSocket message data:', messageData); // Removed log

          // Update requests list
          // Update requests list (now analysisRequests)
          setAnalysisRequests((prevRequests: RequestSummary[]) => { // Add type annotation and correct setter name
            switch (messageData.type) {
              case 'request_created':
                // console.log(`[Frontend WS] Received request_created: ID ${messageData.payload.id}`); // Removed log
                // Payload should be RequestSummary
                const newRequestSummary = messageData.payload as RequestSummary;
                // Avoid adding duplicates
                if (prevRequests.some((req: RequestSummary) => req.id === newRequestSummary.id)) { // Add type annotation
                    console.warn(`[Frontend WS] Request ${newRequestSummary.id} already exists. Updating.`);
                    // Update existing summary if needed (though create usually implies new)
                    return prevRequests.map((req: RequestSummary) => // Add type annotation
                        req.id === newRequestSummary.id ? newRequestSummary : req
                    );
                }
                return [newRequestSummary, ...prevRequests]; // Add the new summary

              case 'request_updated':
                 // console.log(`[Frontend WS] Received request_updated: ID ${messageData.payload.id}`); // Removed log
                 // Payload should be RequestSummary (or partial summary for update)
                 const updatedSummary = messageData.payload as Partial<RequestSummary> & { id: number }; // Use partial for update
                 return prevRequests.map((req: RequestSummary) => // Add type annotation
                   req.id === updatedSummary.id
                     ? { ...req, ...updatedSummary } // Merge updates with existing summary
                     : req
                 );

              case 'request_deleted': {
                const deletedId = messageData.payload.id; // Assuming payload is { id: number }
                // console.log(`[Frontend WS] Received request_deleted: ID ${deletedId}`); // Removed log
                return prevRequests.filter((req: RequestSummary) => req.id !== deletedId); // Add type annotation
              }
              default:
                console.warn('[Frontend WS Event] Received WebSocket message of unknown type:', messageData.type);
                return prevRequests;
            }
          });

          // Update selected request (modal) if necessary
          // Update selected request (modal) if necessary
          // Update selected request (modal) if necessary
          if (messageData.type === 'request_updated') {
            const updatedSummary = messageData.payload as Partial<RequestSummary> & { id: number };
            // Get the latest selected request from the ref to avoid closure issues
            const currentSelectedRequest = selectedRequestRef.current;
            // Removed listSummary lookup as it's no longer needed for the condition or the update logic.

            // Modify the IF condition: Removed listSummary check, use value from ref
            if (currentSelectedRequest && String(currentSelectedRequest.id) === String(updatedSummary.id)) {
                // Debug log removed.
                // console.log(`[Frontend WS] Selected request ${updatedSummary.id} (checked via ref) was updated. Invalidating cache and triggering detail refetch.`); // Removed log
                // --- BEGIN UPDATE PROCESS ---
                // Immediately set loading state and clear current data before invalidating cache and refetching
                setLoadingDetails(true);
                // Debug log removed.
                setSelectedRequest(null); // Clear current details to ensure loading state is shown
                // Debug log removed.
                // console.log(`[Frontend WS] Set loadingDetails=true and cleared selectedRequest for ID ${updatedSummary.id}.`); // Removed log
                // --- END FIX ---

                // Invalidate cache for the updated request before refetching
                // Debug log removed.
                setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => {
                  const newCache = { ...prevCache };
                  delete newCache[updatedSummary.id];
                  // console.log(`[Frontend WS] Removed request ${updatedSummary.id} from details cache.`); // Removed log
                  return newCache;
                });
                // Debug log removed.

                // Directly fetch updated details since the condition is met and cache is invalidated
                // Now that the cache is invalidated and loading state is set, this will fetch fresh data.
                // Debug log removed.
                // Fetch details directly using the ID from the update message
                const fetchUpdatedDetails = async () => {
                  try {
                    // console.log(`[Frontend WS] Fetching updated details for ID: ${updatedSummary.id}`); // Removed log
                    const fullRequestDetails = await getAnalysisRequestDetails(updatedSummary.id);
                    // console.log("[Frontend WS] Fetched Updated Full Request Details:", fullRequestDetails); // Removed log
                    setSelectedRequest(fullRequestDetails); // Set the complete data
                    // Update cache with the newly fetched data
                    setRequestDetailsCache((prevCache: Record<number, AnalysisRequest>) => ({
                      ...prevCache,
                      [updatedSummary.id]: fullRequestDetails
                    }));
                  } catch (error) {
                    message.error(t('app.fetchDetailsError', { id: updatedSummary.id }));
                    console.error("[Frontend WS] Fetch updated request details error:", error);
                    // Optionally close the modal or keep it open showing an error state?
                    // Keeping it open but clearing selection might be confusing. Closing it.
                    setIsModalOpen(false);
                    setSelectedRequest(null); // Clear selection on error
                  } finally {
                    // Loading state was set at the beginning of the 'if' block
                    setLoadingDetails(false);
                    // console.log(`[Frontend WS] Finished fetching updated details for ID: ${updatedSummary.id}. setLoadingDetails=false.`); // Removed log
                  }
                };
                fetchUpdatedDetails(); // Execute the fetch
            }
          } else if (messageData.type === 'request_deleted') {
            const deletedId = messageData.payload.id; // Assuming payload is { id: number }
            setSelectedRequest((prevSelected: AnalysisRequest | null) => { // Type annotation already added
              if (prevSelected && prevSelected.id === deletedId) {
                // console.log(`[Frontend WS] Closing modal because selected request ${deletedId} was deleted.`); // Removed log
                setIsModalOpen(false); // Close modal
                return null; // Clear selection
              }
              return prevSelected;
            });
          }

        } catch (error) {
          console.error('[WebSocket Event] Failed to parse WebSocket message or update state:', error);
        }
      };

      // console.log(`[WebSocket Effect] Assigning onerror listener for ${clientId}...`); // Removed log
      ws.onerror = (event) => { // Note: onerror receives an Event, not necessarily an Error object
        console.error(`[WebSocket Event] onerror fired for ${clientId}:`, event);
        // message.error('WebSocket connection error. Status updates may be unavailable.'); // Replaced with status indicator
        setWsStatus('error'); // Update status state
      };

      // console.log(`[WebSocket Effect] Assigning onclose listener for ${clientId}...`); // Removed log
      ws.onclose = (event) => {
        // console.log(`[WebSocket Event] onclose fired for ${clientId}. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`); // Removed log
        // Only set ref to null if this is the instance currently in the ref
        if (wsRef.current === ws) {
            // console.log(`[WebSocket Effect] Setting wsRef.current to null because the closed instance (${clientId}) matches the ref.`); // Removed log
            wsRef.current = null;
            setWsStatus('disconnected'); // Update status state on clean close matching ref
        } else {
            // console.log(`[WebSocket Effect] WebSocket instance ${clientId} closed, but it doesn't match wsRef.current. Ref not nulled.`); // Removed log
            // If a non-current WS closes, don't change the status unless the current one is already null/disconnected
            if (!wsRef.current) {
                setWsStatus('disconnected');
            }
        }
        // Optional: Attempt to reconnect after a delay if needed
        // if (isInitialized === true) { // Only reconnect if still supposed to be initialized
        //    setTimeout(connectWebSocket, 5000); // Keep potential reconnect logic if desired
        // }
      };

      // Assign the new instance to the ref *after* listeners are attached
      // console.log(`[WebSocket Effect] Assigning wsRef.current = ws instance for ${clientId}`); // Removed log
      wsRef.current = ws;
      setWsStatus('connecting'); // Update status state when attempting connection
    };

    connectWebSocket();

    // Cleanup function to close WebSocket on component unmount or when isInitialized changes
    return () => {
      // console.log('[WebSocket Effect] Cleanup function running...'); // Removed log
      const wsToClose = wsRef.current; // Capture the current ref value
      if (wsToClose) {
        // console.log('[WebSocket Effect] Found WebSocket instance in ref during cleanup. Closing it.'); // Removed log
        // Log which instance is being closed if possible (clientId isn't directly available here, maybe add it to the ref object?)
        wsToClose.close();
        wsRef.current = null; // Clear the ref
        // console.log('[WebSocket Effect] wsRef.current set to null during cleanup.'); // Removed log
      } else {
          // console.log('[WebSocket Effect] No WebSocket instance found in ref during cleanup.'); // Removed log
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
