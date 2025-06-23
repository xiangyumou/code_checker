import React from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Added Skeleton, Tooltip, Typography
import { List, Tag, Spin, Empty, Button, Skeleton, Tooltip, Typography, Space, theme } from 'antd'; // Added theme
// Added specific icons for status
import { SyncOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'; // Added FileTextOutlined
import { AnalysisRequest, RequestStatus, RequestSummary } from '../../../types/index'; // Import RequestSummary
import dayjs from 'dayjs'; // Import dayjs for date formatting

const { Text, Title } = Typography; // Destructure Title as well
const { useToken } = theme; // Destructure useToken

interface RequestListProps {
  requests: RequestSummary[]; // Use RequestSummary[]
  loading: boolean;
  selectedRequestId: number | null; // Added prop for selected item ID
  onSelectRequest: (request: RequestSummary) => void; // Use RequestSummary
  onRefresh: () => void;
}

// Helper to get status display properties
// Use t function passed as argument for status text
const getStatusProps = (status: RequestStatus, t: (key: string) => string): { color: string; icon: React.ReactNode; text: string } => {
  switch (status) {
    case 'Completed': return { color: 'success', icon: <CheckCircleOutlined />, text: t('requestList.completed') };
    case 'Processing': return { color: 'processing', icon: <SyncOutlined spin />, text: t('requestList.processing') };
    case 'Failed': return { color: 'error', icon: <CloseCircleOutlined />, text: t('requestList.failed') };
    case 'Queued': return { color: 'default', icon: <ClockCircleOutlined />, text: t('requestList.pending') }; // Assuming 'Queued' maps to 'pending' key
    default: return { color: 'default', icon: <QuestionCircleOutlined />, text: status }; // Fallback for unknown status
  }
};

const RequestList: React.FC<RequestListProps> = ({
  requests,
  loading,
  selectedRequestId, // Destructure new prop
  onSelectRequest,
  onRefresh
}) => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const { token } = useToken(); // Get theme tokens

  const renderItem = (item: RequestSummary) => { // Use RequestSummary
    const statusProps = getStatusProps(item.status, t); // Pass t to helper
    // Use filename if available, otherwise default title
    const titleText = t('requestList.itemTitle', { id: item.id }); // Always use standard title format
    const isSelected = item.id === selectedRequestId;

    const statusTag = (
        <Tag icon={statusProps.icon} color={statusProps.color} style={{ marginInlineEnd: 0 }}> {/* Remove default margin */}
            {statusProps.text}
        </Tag>
    );

    return (
      <List.Item
        key={item.id}
        onClick={() => onSelectRequest(item)}
        style={{
          cursor: 'pointer',
          padding: '12px 16px', // Consistent padding
          transition: 'background-color 0.2s, border-left 0.2s', // Smooth transition
          // Use primary color with transparency for selected background
          backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
          // Add a left border highlight for selected item
          borderLeft: isSelected ? `3px solid ${token.colorPrimary}` : `3px solid transparent`,
          marginLeft: isSelected ? '-3px' : '0px', // Adjust margin to keep content aligned when border appears
        }}
        actions={[ // Keep status tag in actions for alignment
            item.status === 'Failed' && item.error_message ? (
                <Tooltip title={item.error_message} placement="topLeft">
                    {statusTag}
                </Tooltip>
            ) : (
                statusTag
            )
        ]}
      >
        {/* Use List.Item.Meta for structured content */}
        <List.Item.Meta
          style={{ flex: 1, minWidth: 0, marginRight: '8px' }} // Allow meta to grow/shrink and add spacing
          title={
            <Space size={4}> {/* Add space for icon */}
              {item.filename && <FileTextOutlined style={{ color: token.colorTextSecondary }} />} {/* Show icon if filename exists */}
              <Text strong ellipsis style={{ marginBottom: 0 }}> {/* Make title bold and add ellipsis */}
                {titleText}
              </Text>
            </Space>
          }
          description={
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {/* Show ID along with date */}
              ID: {item.id} - {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          }
        />
      </List.Item>
    );
  };

  // Calculate a reasonable number of skeleton items based on typical view height
  const skeletonItemCount = 8;

  return (
    // Ensure the root div fills the height and uses flex column layout
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'transparent' /* Let parent Col handle background */ }}>
        {/* Unified Header Section */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between', // Title left, Button right
            alignItems: 'center',
            padding: '12px 16px 8px 16px', // Adjust bottom padding
            borderBottom: `1px solid ${token.colorSplit}`, // Use theme split line color
            flexShrink: 0, // Prevent header from shrinking
            marginBottom: '8px', // Add margin below header
        }}>
            <Title level={5} style={{ margin: 0 }}> {/* Use level 5 for slightly smaller title */}
                {t('requestList.title')}
            </Title>
            <Tooltip title={t('requestList.refreshTooltip')}> {/* Define new key */}
                <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    onClick={onRefresh}
                    disabled={loading}
                    size="small"
                    style={{ color: token.colorTextSecondary }} // Match secondary text color
                />
            </Tooltip>
        </div>

        {/* List or Skeleton/Empty - Ensure this part scrolls */}
        <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}> {/* Make list scrollable */}
            {loading ? (
                // Show Skeleton when loading
                <div style={{ padding: '0 16px' }}> {/* Add padding for skeleton */}
                    <List
                        itemLayout="horizontal"
                        dataSource={Array.from({ length: skeletonItemCount }).map((_, i) => ({ id: i, loading: true }))} // Dummy data source
                        renderItem={() => (
                            <List.Item style={{ padding: '12px 0' }}> {/* Adjust skeleton item padding */}
                                {/* Simplified Skeleton structure */}
                                <Skeleton active avatar={false} title={{ width: '70%' }} paragraph={{ rows: 1, width: '50%' }} />
                            </List.Item>
                        )}
                        split={false} // Remove dividers for skeleton
                    />
                </div>
            ) : requests.length > 0 ? (
                // Show actual list
                <List
                    itemLayout="horizontal" // Keep horizontal layout
                    dataSource={requests}
                    renderItem={renderItem}
                    // Consider adding rowKey if IDs might not be unique temporarily during updates
                    // rowKey="id"
                />
            ) : (
                // Show Empty state
                <Empty description={t('requestList.noHistory')} style={{ marginTop: '50px', color: token.colorTextSecondary }} /> // Define new key
            )} {/* Removed the comment entirely */}
        </div>
    </div>
  );
};

export default RequestList;

// Note: The ':hover' pseudo-class in inline styles won't work directly.
// For a proper hover effect, it's better to use CSS Modules or styled-components.
// However, for simplicity in this diff, I've left the structure.
// Ant Design's List.Item might handle hover internally if theme is configured.
// We'll rely on Ant Design's default hover or refine later if needed.