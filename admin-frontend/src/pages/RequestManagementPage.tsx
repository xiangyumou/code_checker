import React, { useState, useEffect } from 'react'; // Removed useCallback, useRef
import { Table, Tag, Button, Space, Select, message, Popconfirm, Typography, Card } from 'antd'; // Removed Modal, Checkbox, Select Option
import { useTranslation } from 'react-i18next'; // Import useTranslation
const { Title } = Typography; // Destructure Title here
import { EyeOutlined, DeleteOutlined, SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult, FilterValue } from 'antd/es/table/interface';
import RequestDetailDrawer from '../components/RequestDetailDrawer'; // Import the new Drawer component

// Import API functions and types
import {
    // getAdminAnalysisRequests, // No longer fetched here
    deleteAdminAnalysisRequest,
    retryAdminAnalysisRequest,
    batchAdminRequestAction
} from '../api/adminRequests';
import { AnalysisRequest, RequestStatus, RequestSummary } from '../types'; // Adjusted path, added RequestSummary
// Removed AdminRequestDetailView import, it will be used inside the Drawer/MainLayout

// Removed Option = Select;

// Define possible statuses for filtering
const STATUS_OPTIONS: RequestStatus[] = ['Queued', 'Processing', 'Completed', 'Failed'];

// Define props interface
interface RequestManagementPageProps {
    requests: RequestSummary[]; // Changed to RequestSummary[]
    loading: boolean;
    onRefresh: () => void; // Function to trigger data refresh in parent
    onOpenDetails: (requestId: number) => void; // Function to trigger detail view in parent
    // Removed deletedRequestIdForDetailView and resetDeletedRequestId
}

const RequestManagementPage: React.FC<RequestManagementPageProps> = ({
    requests,
    loading,
    onRefresh,
    onOpenDetails // Receive new prop
    // Removed deletedRequestIdForDetailView, resetDeletedRequestId
}) => {
    const { t } = useTranslation(); // Initialize useTranslation hook

    // Keep local state for UI elements specific to this page
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [pagination, setPagination] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 20,
        total: 0, // This might need adjustment based on how total is handled in parent
        showSizeChanger: true,
        showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} items`, // Added types
    });
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
    const [sorter, setSorter] = useState<SorterResult<RequestSummary>>({}); // Changed type to RequestSummary

    // Removed local state for Drawer visibility and details - now handled by MainLayout

    // Removed fetchData function - now handled by parent (MainLayout)
    // Removed initial fetch useEffect - now handled by parent
    // Removed WebSocket useEffect - now handled by parent

    // Update table pagination total when requests prop changes (if parent doesn't provide total)
    // This is a basic way; a more robust solution might involve the parent passing total count
    useEffect(() => {
        setPagination((prev: TablePaginationConfig) => ({ ...prev, total: requests.length })); // Added type for prev
    }, [requests]);


    // Handle table changes (pagination, filters, sorter)
    const handleTableChange = (
        newPagination: TablePaginationConfig,
        newFilters: Record<string, FilterValue | null>,
        newSorter: SorterResult<RequestSummary> | SorterResult<RequestSummary>[] // Changed type to RequestSummary
    ) => {
        const singleSorter = Array.isArray(newSorter) ? newSorter[0] : newSorter; // Type assertion might be needed if TS complains
        // Update local state for immediate UI feedback
        // Update local state for immediate UI feedback
        setPagination(newPagination);
        setFilters(newFilters);
        setSorter(singleSorter);
        // Parent (MainLayout) should ideally handle fetching based on these changes
        // We might need to pass these up or have the parent manage them entirely
        // For now, the parent's onRefresh doesn't take these params.
        // Consider calling onRefresh() here as well, assuming parent refetches with latest state?
        // onRefresh(); // Or modify onRefresh prop to accept params
    };

    // Removed handleViewDetails function - now handled by onRow click calling parent's handler

    const handleDelete = async (requestId: number) => {
        // setLoading(true); // Loading state now managed by parent
        try {
            await deleteAdminAnalysisRequest(requestId);
            message.success(`Request ${requestId} deleted.`);
            onRefresh(); // Call the passed-in refresh handler from parent
        } catch (error) {
            // Error handled by API message
            // setLoading(false); // Parent handles loading
        }
    };

    const handleRetry = async (requestId: number) => {
        // setLoading(true); // Parent handles loading
        try {
            await retryAdminAnalysisRequest(requestId);
            message.success(`Request ${requestId} sent for retry.`);
            onRefresh(); // Refresh list via parent (or rely on WebSocket update)
        } catch (error) {
             // setLoading(false); // Parent handles loading
        }
    };

    // --- Batch Actions ---
    const handleBatchAction = async (action: 'delete' | 'retry') => {
        if (selectedRowKeys.length === 0) {
            message.warning(`Please select requests to ${action}.`);
            return;
        }
        // setLoading(true); // Parent handles loading
        try {
            await batchAdminRequestAction({
                action: action,
                request_ids: selectedRowKeys as number[],
            });
            message.success(`Batch ${action} initiated for ${selectedRowKeys.length} requests.`);
            setSelectedRowKeys([]); // Clear selection after action
            onRefresh(); // Refresh list via parent after batch action (or rely on WebSocket)
        } catch (error) {
            // Error handled by API
            // setLoading(false); // Parent handles loading
        }
    };


    // --- Table Columns (No changes needed here initially) ---
    // Use t() for column titles
    const columns: ColumnsType<RequestSummary> = [ // Changed type to RequestSummary
        {
            title: t('requestManagement.id'),
            dataIndex: 'id',
            key: 'id',
            sorter: (a: RequestSummary, b: RequestSummary) => a.id - b.id, // Added types
            sortOrder: sorter.columnKey === 'id' ? sorter.order : null,
            width: 80,
        },
        {
            title: t('requestManagement.status'),
            dataIndex: 'status',
            key: 'status',
            filters: STATUS_OPTIONS.map(status => ({ text: status, value: status })),
            filteredValue: filters.status || null,
            render: (status: RequestStatus) => {
                let color = 'default';
                if (status === 'Completed') color = 'success';
                else if (status === 'Processing') color = 'processing';
                else if (status === 'Failed') color = 'error';
                return <Tag color={color} icon={status === 'Processing' ? <SyncOutlined spin /> : undefined}>{status}</Tag>;
            },
            width: 120,
        },
        {
            title: t('requestManagement.createdAt'), // Define new key
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text: string) => text ? new Date(text).toLocaleString() : '-',
            sorter: (a: RequestSummary, b: RequestSummary) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(), // Added types
            sortOrder: sorter.columnKey === 'created_at' ? sorter.order : null,
            width: 180,
            responsive: ['lg'], // Hide on screens smaller than lg
        },
         {
            title: t('requestManagement.updatedAt'), // Define new key
            dataIndex: 'updated_at',
            key: 'updated_at',
            render: (text: string) => text ? new Date(text).toLocaleString() : '-',
            sorter: (a: RequestSummary, b: RequestSummary) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(), // Added types
            sortOrder: sorter.columnKey === 'updated_at' ? sorter.order : null,
            width: 180,
            responsive: ['lg'], // Hide on screens smaller than lg
        },
        { // Added opening brace
            title: t('requestManagement.filename'), // Added filename column
            dataIndex: 'filename',
            key: 'filename',
            ellipsis: true,
            render: (text: string | null) => text || '-', // Added type annotation for text
            responsive: ['md'], // Show on medium screens and up
        }, // Kept closing brace and comma
        {
            title: t('requestManagement.error'), // Define new key
            dataIndex: 'error_message',
            key: 'error',
            ellipsis: true, // Truncate long error messages
            render: (text: string | null | undefined) => text || '-', // Added type annotation for text
            responsive: ['lg'], // Hide on screens smaller than lg
        },
        // Removed imageCount column as it's not in RequestSummary
        {
            title: t('requestManagement.actions'),
            key: 'actions',
            render: (_: any, record: RequestSummary) => { // Added types
                const isFailed = record.status === 'Failed';
                return (
                    <Space size="middle">
                        {/* Removed View Details Button - handled by onRow click */}
                        <Popconfirm
                            title={t('requestManagement.deleteConfirm')} // Define new key
                            onConfirm={() => handleDelete(record.id)}
                            okText={t('confirm')} // Define new key
                            cancelText={t('cancel')} // Define new key
                        >
                            <Button icon={<DeleteOutlined />} danger size="small">{t('delete')}</Button> {/* Define new key */}
                        </Popconfirm>
                        {/* Conditionally render Popconfirm only for failed status */}
                        {isFailed ? (
                            <Popconfirm
                                title={t('requestManagement.retryConfirm')} // Define new key
                                onConfirm={() => handleRetry(record.id)}
                                okText={t('confirm')} // Use same key
                                cancelText={t('cancel')} // Use same key
                            >
                                <Button icon={<ReloadOutlined />} size="small">{t('retry')}</Button> {/* Define new key */}
                            </Popconfirm>
                        ) : (
                            // Render a disabled button directly for other statuses
                            <Button icon={<ReloadOutlined />} size="small" disabled>{t('retry')}</Button> // Use same key
                        )} {/* Closing parenthesis for the conditional rendering */}
                    </Space>
                ); // Closing parenthesis for the render function return
            },
            fixed: 'right', // Keep actions visible
            width: 200,
        },
    ];

    // Row selection config
    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    };

    const hasSelected = selectedRowKeys.length > 0;

    // Update component to use props and new layout structure
    return (
        <Card> {/* Wrap content in a Card */}
            <Title level={2} style={{ marginBottom: '24px' }}>{t('requestManagement.title')}</Title>
            <div style={{ marginBottom: 16 }}>
                <Space wrap> {/* Added wrap for smaller screens */}
                    {/* Use onRefresh prop for the refresh button */}
                    <Button onClick={onRefresh} loading={loading} icon={<SyncOutlined />}>
                        {t('refresh')} {/* Define new key */}
                    </Button>
                    <Popconfirm
                        // Use t() with interpolation for count
                        title={t('requestManagement.batchDeleteConfirm', { count: selectedRowKeys.length })} // Define new key
                        disabled={!hasSelected || loading} // Disable if loading
                        onConfirm={() => handleBatchAction('delete')}
                        okText={t('confirm')} // Use same key
                        cancelText={t('cancel')} // Use same key
                    >
                        <Button type="primary" danger disabled={!hasSelected || loading} loading={false}>
                            {t('deleteSelected')} {/* Define new key */}
                        </Button>
                    </Popconfirm>
                     <Popconfirm
                        // Use t() with interpolation for count
                        title={t('requestManagement.batchRetryConfirm', { count: selectedRowKeys.length })} // Define new key
                        disabled={!hasSelected || loading} // Disable if loading
                        onConfirm={() => handleBatchAction('retry')}
                        okText={t('confirm')} // Use same key
                        cancelText={t('cancel')} // Use same key
                    >
                        <Button type="default" disabled={!hasSelected || loading} loading={false}>
                            {t('retrySelected')} {/* Define new key */}
                        </Button>
                    </Popconfirm>
                    <span style={{ marginLeft: 8 }}>
                        {/* Use t() with interpolation for count */}
                        {hasSelected ? t('selectedItems', { count: selectedRowKeys.length }) : ''} {/* Define new key */}
                    </span>
                </Space>
            </div>
            <Table
                columns={columns}
                rowKey="id"
                dataSource={requests} // Use requests from props
                pagination={pagination} // Use local pagination state
                loading={loading} // Use loading from props
                onChange={handleTableChange} // Keep local handler for pagination/filter/sort state
                rowSelection={rowSelection}
                // scroll={{ x: 1200 }} // Commented out to disable horizontal scroll
                onRow={(record: RequestSummary) => { // Added type
                    return {
                        onClick: () => { onOpenDetails(record.id); }, // Call parent handler with ID
                        style: { cursor: 'pointer' } // Add pointer cursor to indicate clickability
                    };
                }}
            />
            {/* Removed RequestDetailDrawer rendering - now handled by parent (MainLayout or wrapper) */}
        </Card> // Close Card wrapper
    );
};

export default RequestManagementPage;