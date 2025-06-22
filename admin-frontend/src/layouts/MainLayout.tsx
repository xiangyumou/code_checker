import React, { useState, useEffect, useCallback, useRef } from 'react'; // Removed createContext, useContext (not used directly here)
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom'; // Added Outlet
import { Layout, Menu, Spin, Button, Typography, theme, message, Breadcrumb, Dropdown, Avatar, Space } from 'antd';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import {
    LoginOutlined, LogoutOutlined, SettingOutlined, DatabaseOutlined, FileTextOutlined,
    DashboardOutlined, MonitorOutlined, UserOutlined // Added new icons
} from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Assuming App.css contains relevant layout styles or create a specific MainLayout.css
// import './MainLayout.css'; // Or keep using App.css if styles are general

// Import API functions and types
import { getAdminAnalysisRequests, getAdminAnalysisRequestDetails } from '../api/adminRequests'; // Added getAdminAnalysisRequestDetails
// Use AnalysisRequest type, define specific WebSocket message type below
// Adjust path relative to layouts directory
import { AnalysisRequest, RequestStatus, RequestSummary } from '../types'; // Corrected import path, added RequestSummary

// Import page components (adjust paths relative to layouts directory)
import SettingsPage from '../pages/SettingsPage';
import RequestManagementPage from '../pages/RequestManagementPage';
import LogViewerPage from '../pages/LogViewerPage';
// Import placeholder DashboardPage (will be created later)
// Assuming DashboardPage will be in src/pages
import DashboardPage from '../pages/DashboardPage'; // Ensure this path is correct
import ThemeSwitcher from '../components/ThemeSwitcher'; // Import ThemeSwitcher
import LanguageSwitcher from '../components/LanguageSwitcher'; // Import LanguageSwitcher
import RequestDetailDrawer from '../components/RequestDetailDrawer'; // Import the drawer component

// Import Auth context hook (adjust path)
import { useAuth } from '../contexts/AuthContext'; // Corrected import path

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text } = Typography;

// --- Main Application Layout (for authenticated users) ---
const MainLayout: React.FC = () => {
    const { t } = useTranslation(); // Initialize useTranslation hook
    const { logout, user } = useAuth(); // Assuming user info is available in AuthContext
    const navigate = useNavigate();
    const location = useLocation();
    // Use theme hook correctly
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken(); // Get borderRadiusLG as well

    // *** Lifted State ***
    const [requests, setRequests] = useState<RequestSummary[]>([]); // Changed type to RequestSummary[]
    const [loadingRequests, setLoadingRequests] = useState(false);
    // State for caching full request details
    const [requestDetailsCache, setRequestDetailsCache] = useState<Record<number, AnalysisRequest>>({});
    // State for the currently selected full request details for the drawer
    const [selectedRequestDetails, setSelectedRequestDetails] = useState<AnalysisRequest | null>(null);
    // State for the ID of the request whose detail drawer is open
    const [detailDrawerRequestId, setDetailDrawerRequestId] = useState<number | null>(null);
    // State to track ID of a request deleted while its detail view might be open (Keep this for now, might be redundant later)
    const [deletedRequestIdForDetailView, setDeletedRequestIdForDetailView] = useState<number | null>(null);
    // *** End Lifted State ***

    // Ref to track the latest selected request details for WebSocket handler
    const selectedRequestDetailsRef = useRef<AnalysisRequest | null>(null);

    // Keep the ref updated whenever the state changes
    useEffect(() => {
        selectedRequestDetailsRef.current = selectedRequestDetails;
    }, [selectedRequestDetails]);

    // Function to reset the deleted ID state (passed down to detail view)
    const resetDeletedRequestId = useCallback(() => {
        setDeletedRequestIdForDetailView(null);
    }, []);

    // *** Lifted fetchData Function ***
    const fetchData = useCallback(async () => {
        // TODO: Add pagination/filter/sort params if needed later
        setLoadingRequests(true);
        try {
            // Fetch all for now, adjust params as needed
            const fetchedRequests = await getAdminAnalysisRequests(undefined, 0, 500); // Fetch more initially?
            setRequests(fetchedRequests);
        } catch (error) {
            message.error('Failed to fetch analysis requests.');
            console.error("Fetch admin requests error:", error);
        } finally {
            setLoadingRequests(false);
        }
    }, []); // Empty dependency array for now
    // *** End Lifted fetchData Function ***

    // *** WebSocket Logic (Moved here) ***
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {

        const connectWebSocket = () => {
          if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
              return;
          }

          // Generate unique client ID using uuid
          const clientId = `admin-${uuidv4()}`;
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // Assuming the backend endpoint remains /ws/status/{client_id}
          const wsUrl = `${wsProtocol}//${window.location.host}/ws/status/${clientId}`;

          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            message.success('Admin: Real-time status updates connected.');
          };

          // Define more specific WebSocket message structures
          interface WebSocketCreatedPayload extends RequestSummary {}
          interface WebSocketUpdatedPayload extends Partial<RequestSummary> { // Backend might only send updated fields + id
            id: number;
          }
          interface WebSocketDeletedPayload {
            id: number; // Assuming backend sends 'id' for consistency with other events
          }
          interface WebSocketMessage {
            type: 'request_created' | 'request_updated' | 'request_deleted';
            payload: WebSocketCreatedPayload | WebSocketUpdatedPayload | WebSocketDeletedPayload;
          }

          ws.onmessage = (event) => {
            try {
              const messageData: WebSocketMessage = JSON.parse(event.data);

              // Process message and update state outside the setRequests callback
              switch (messageData.type) {
                case 'request_created': {
                  const createdPayload = messageData.payload as WebSocketCreatedPayload;
                  setRequests((prevRequests: RequestSummary[]) => {
                    // Avoid adding duplicates
                    if (prevRequests.some((req: RequestSummary) => req.id === createdPayload.id)) {
                      console.warn(`[Admin WS] Request ${createdPayload.id} already exists, likely due to race condition. Updating instead.`);
                      return prevRequests.map((req: RequestSummary) =>
                        req.id === createdPayload.id ? createdPayload : req
                      );
                    }
                    // Add the new request summary
                    return [createdPayload, ...prevRequests];
                  });
                  break;
                }
                case 'request_updated': {
                  const updatedPayload = messageData.payload as WebSocketUpdatedPayload;

                  // *** DEBUG LOGGING AND REF USAGE START ***
                  const currentSelectedDetails = selectedRequestDetailsRef.current; // Get current value from ref

                  // Modify the condition to use the ref's value
                  if (currentSelectedDetails && String(currentSelectedDetails.id) === String(updatedPayload.id)) {

                    // --- Immediate Partial Update ---
                    setSelectedRequestDetails((prevDetails: AnalysisRequest | null) => {
                      // Ensure we have previous details and the ID matches before merging
                      // Note: Using prevDetails here is fine as it's the state setter's argument
                      if (prevDetails && prevDetails.id === updatedPayload.id) {
                        return { ...prevDetails, ...updatedPayload };
                      }
                      return { ...updatedPayload } as AnalysisRequest;
                    });
                    // --- End Immediate Partial Update ---

                    // --- Asynchronous Full Refetch ---
                    getAdminAnalysisRequestDetails(updatedPayload.id)
                      .then(fullDetails => {
                        // Update with the complete details from API
                        setSelectedRequestDetails(fullDetails);
                        // Update cache with full details
                        setRequestDetailsCache((prev: Record<number, AnalysisRequest>) => ({ ...prev, [updatedPayload.id]: fullDetails }));
                      })
                      .catch((error: Error) => {
                        console.error(`[Admin WS] Error refetching FULL details for request ${updatedPayload.id} after update:`, error);
                        message.error(`Failed to refresh full details for request #${updatedPayload.id} after update.`);
                        // Keep the partially updated state in case of full fetch error
                      });
                    // --- End Asynchronous Full Refetch ---
                  } else {
                      // Optional: Log if the condition was false but the drawer ID matched (for extra debugging)
                      // if (detailDrawerRequestId === updatedPayload.id) {
                      //     console.log(`[ADMIN DEBUG] Condition FALSE, but detailDrawerRequestId (${detailDrawerRequestId}) matched updatedPayload.id (${updatedPayload.id}). Ref value was:`, currentSelectedDetails);
                      // }
                  }
                  // *** DEBUG LOGGING AND REF USAGE END ***

                  // Update the summary in the list (this part remains unchanged)
                  setRequests((prevRequests: RequestSummary[]) =>
                    prevRequests.map((req: RequestSummary) =>
                      req.id === updatedPayload.id
                        ? { ...req, ...updatedPayload } // Spread partial update onto existing summary
                        : req
                    )
                  );
                  break;
                }
                case 'request_deleted': {
                  const deletedPayload = messageData.payload as WebSocketDeletedPayload;
                  const deletedId = deletedPayload.id;

                  // Check if the deleted request's detail drawer is currently open (Side effect)
                  if (detailDrawerRequestId === deletedId) {
                    handleCloseRequestDetails();
                  }
                  // Also reset the older state variable if it matches
                  if (deletedRequestIdForDetailView === deletedId) {
                       setDeletedRequestIdForDetailView(null);
                  }

                  // Filter out the deleted request from the main list
                  setRequests((prevRequests: RequestSummary[]) =>
                    prevRequests.filter((req: RequestSummary) => req.id !== deletedId)
                  );
                  break;
                }
                default:
                  console.warn('[Admin WS Event - MainLayout] Received WebSocket message of unknown type:', messageData.type);
              }

            } catch (error) {
              console.error('[Admin WS Event - MainLayout] Failed to parse WebSocket message or update state:', error);
            }
          };

          ws.onerror = (event) => {
            console.error(`[Admin WS Event - MainLayout] onerror fired for ${clientId}:`, event);
            message.error('Admin: WebSocket connection error. Status updates may be unavailable.');
          };

          ws.onclose = (event) => {
            if (wsRef.current === ws) {
                wsRef.current = null;
            } else {
            }
            // Optional: Reconnect logic
            // if (!event.wasClean) {
            //    console.log('[Admin WS Effect - MainLayout] Connection closed unexpectedly. Attempting reconnect in 5s...');
            //    setTimeout(connectWebSocket, 5000);
            // }
          };
          wsRef.current = ws;
        };

        connectWebSocket();

        return () => {
          const wsToClose = wsRef.current;
          if (wsToClose) {
            wsToClose.onopen = null;
            wsToClose.onmessage = null;
            wsToClose.onerror = null;
            wsToClose.onclose = null;
            wsToClose.close(1000, "MainLayout unmounting");
            wsRef.current = null;
          } else {
          }
        };
      }, []); // Empty dependency array: connect only once when MainLayout mounts
    // *** End WebSocket Logic ***

    // Fetch initial data when MainLayout mounts
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Detail Loading Logic ---
    const handleOpenRequestDetails = useCallback(async (requestId: number) => {
        setDetailDrawerRequestId(requestId); // Open drawer immediately

        if (requestDetailsCache[requestId]) {
            setSelectedRequestDetails(requestDetailsCache[requestId]);
        } else {
            setSelectedRequestDetails(null); // Show loading state in drawer
            try {
                const details = await getAdminAnalysisRequestDetails(requestId);
                setSelectedRequestDetails(details);
                setRequestDetailsCache((prev: Record<number, AnalysisRequest>) => ({ ...prev, [requestId]: details }));
            } catch (error) {
                console.error(`[MainLayout] Error fetching details for request ${requestId}:`, error);
                message.error(`Failed to load details for request #${requestId}.`);
                // Optionally close drawer on error, or let drawer display an error state
                // setDetailDrawerRequestId(null);
            }
        }
    }, [requestDetailsCache]); // Dependency: requestDetailsCache

    const handleCloseRequestDetails = useCallback(() => {
        setDetailDrawerRequestId(null);
        setSelectedRequestDetails(null);
    }, []);
    // --- End Detail Loading Logic ---

    // --- Menu and Breadcrumb Logic ---
    // Use t() function for menu labels
    const menuItems = [
        { key: '/dashboard', icon: <DashboardOutlined />, label: t('dashboard') },
        { key: '/requests', icon: <DatabaseOutlined />, label: t('requestManagement.title') }, // Use existing key
        {
            key: 'monitoring', icon: <MonitorOutlined />, label: t('systemMonitoring.title'), // Define new key
            children: [
                { key: '/logs', icon: <FileTextOutlined />, label: t('logs') }, // Use existing key
                // Add other monitoring links here later
            ],
        },
        {
            key: 'settings', icon: <SettingOutlined />, label: t('settingsPage.title'), // Use existing key
            children: [
                // Link directly to the main settings page for now
                { key: '/settings', label: t('settingsPage.appAndProfile') }, // Define new key
                // Could add direct links to tabs later if needed:
                // { key: '/settings/app', label: t('settingsPage.appSettings') }, // Define new key
                // { key: '/settings/profile', label: t('settingsPage.profileSettings') }, // Define new key
            ],
        },
    ];

    // Determine selected keys and open keys for the menu based on current path
    const getCurrentPathKeys = () => {
        const path = location.pathname;
        let openKey = '';
        // Find the parent key if the current path is a child
        for (const item of menuItems) {
            if (item.children) {
                for (const child of item.children) {
                    // Handle nested settings path if direct linking is used later
                    // if (child.key === path || (path.startsWith('/settings') && item.key === 'settings')) {
                    if (child.key === path) {
                        openKey = item.key;
                        break;
                    }
                }
            }
            if (openKey) break;
        }
        // Special case for settings main page
        if (path === '/settings' && !openKey) {
             const settingsParent = menuItems.find(item => item.key === 'settings');
             if (settingsParent) openKey = settingsParent.key;
        }
        return { selectedKey: path, openKey: openKey ? [openKey] : [] };
    };
    const { selectedKey, openKey } = getCurrentPathKeys();

    // Generate Breadcrumb items using t()
    // Note: Keys in breadcrumbNameMap should match the translation keys for consistency
    const breadcrumbNameMap: Record<string, string> = {
        '/dashboard': t('dashboard'),
        '/requests': t('requestManagement.title'),
        '/monitoring': t('systemMonitoring.title'), // Use the same new key as menu
        '/logs': t('logs'),
        '/settings': t('settingsPage.title'),
        // '/settings/app': t('settingsPage.appSettings'), // Use the same new key as menu
        // '/settings/profile': t('settingsPage.profileSettings'), // Use the same new key as menu
    };

    const pathSnippets = location.pathname.split('/').filter((i: string) => i);
    // Generate breadcrumb items as objects for the 'items' prop
    const breadcrumbItems = [
        {
            key: 'home',
            // Use t() for the home breadcrumb link
            title: <a onClick={() => navigate('/dashboard')}>{t('dashboard')}</a>,
        },
        ...pathSnippets.map((_: string, index: number) => {
            const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
            // Use translated name from map, fallback to snippet
            const name = breadcrumbNameMap[url] || url.substring(url.lastIndexOf('/') + 1); // Fallback
            const isLast = index === pathSnippets.length - 1;
            return {
                key: url,
                title: isLast ? name : <a onClick={() => navigate(url)}>{name}</a>,
            };
        }),
    ];


    // --- User Menu Logic ---
    const handleUserMenuClick = (e: { key: string }) => {
        if (e.key === 'profile') {
            navigate('/settings'); // Navigate to settings page (tabs handle specifics)
        } else if (e.key === 'logout') {
            logout();
            // No need to navigate here, ProtectedRoute will handle redirect
        }
    };

    // Use t() for user menu items
    const userMenuItems = [
        { key: 'profile', icon: <UserOutlined />, label: t('userMenu.profile') }, // Define new key
        { key: 'logout', icon: <LogoutOutlined />, label: t('logout') }, // Use existing key
    ];

    // Get username from context
    const username = user?.username || 'Admin'; // Use user from useAuth()

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
                <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Use t() for the panel title */}
                    <Title level={5} style={{ color: 'white', margin: 0 }}>{t('adminPanel.title')}</Title> {/* Define new key */}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    defaultOpenKeys={openKey} // Use defaultOpenKeys for initial render
                    onClick={({ key }: { key: string }) => navigate(key)} // Added explicit type for key
                    items={menuItems}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Breadcrumb items={breadcrumbItems} />
                    {/* Right side controls: Language Switcher, Theme Switcher and User Menu */}
                    <Space>
                        <LanguageSwitcher /> {/* Add the language switcher */}
                        <ThemeSwitcher /> {/* Add the theme switcher */}
                        <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
                            <a onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault()} style={{cursor: 'pointer'}}>
                                <Space>
                                    <Avatar size="small" icon={<UserOutlined />} />
                                    <Text>{username}</Text> {/* Display username */}
                                </Space>
                            </a>
                        </Dropdown>
                    </Space>
                </Header>
                <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
                    {/* Use Outlet to render nested routes */}
                    <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: 'calc(100vh - 64px - 48px - 69px)' }}> {/* Adjust minHeight based on Header/Footer/Margin */}
                         {/* Pass necessary state and functions down via Outlet context */}
                         {/* Pass down new state and handlers */}
                         <Outlet context={{
                             requests,
                             loadingRequests,
                             fetchData,
                             deletedRequestIdForDetailView, // Keep for now
                             resetDeletedRequestId, // Keep for now
                             // Add new props for detail loading
                             requestDetailsCache,
                             selectedRequestDetails,
                             detailDrawerRequestId,
                             handleOpenRequestDetails, // Pass implemented function
                             handleCloseRequestDetails, // Pass implemented function
                             // Removed direct setters unless absolutely necessary elsewhere
                         }} />
                    </div>
                </Content>
                {/* Use t() for the footer text */}
                {/* <Footer style={{ textAlign: 'center', padding: '12px 50px' }}>{t('adminPanel.title')} ©{new Date().getFullYear()}</Footer> */}
            </Layout>
            {/* Render the RequestDetailDrawer here, controlled by MainLayout state */}
            <RequestDetailDrawer
                open={detailDrawerRequestId !== null}
                onClose={handleCloseRequestDetails}
                requestData={selectedRequestDetails}
                loading={detailDrawerRequestId !== null && selectedRequestDetails === null} // Show loading when drawer is open but details are not yet loaded/fetched
                deletedRequestId={deletedRequestIdForDetailView} // Pass the deleted ID state
                resetDeletedRequestId={resetDeletedRequestId} // Pass the reset function
            />
        </Layout>
    );
};

export default MainLayout; // Export the layout component