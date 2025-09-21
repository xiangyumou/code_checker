import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, Tag, Button, Space, Select, message, Popconfirm, Typography, Card } from 'antd'; // Removed Modal, Checkbox, Select Option
import { useTranslation } from 'react-i18next'; // Import useTranslation
const { Title } = Typography; // Destructure Title here
import { EyeOutlined, DeleteOutlined, SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult, FilterValue } from 'antd/es/table/interface';
import RequestDetailDrawer from '../../../components/shared/RequestDetailDrawer'; // Import the new Drawer component

// Import API functions and types
import {
    // getAdminAnalysisRequests, // No longer fetched here
    deleteAdminAnalysisRequest,
    retryAdminAnalysisRequest,
    batchAdminRequestAction
} from '../api/adminRequests';
import { AnalysisRequest, RequestStatus, RequestSummary } from '../../../types/index'; // Adjusted path, added RequestSummary
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
    // Pagination props
    currentPage: number;
    pageSize: number;
    totalRequests: number;
    onPageChange: (page: number, size?: number) => void;
    // Removed deletedRequestIdForDetailView and resetDeletedRequestId
}

const RequestManagementPage: React.FC<RequestManagementPageProps> = React.memo(({
    requests,
    loading,
    onRefresh,
    onOpenDetails, // Receive new prop
    // Pagination props
    currentPage,
    pageSize,
    totalRequests,
    onPageChange
    // Removed deletedRequestIdForDetailView, resetDeletedRequestId
}) => {
    const { t } = useTranslation(); // Initialize useTranslation hook

    // Keep local state for UI elements specific to this page
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    // Use pagination from props instead of local state
    const pagination: TablePaginationConfig = useMemo(() => ({
        current: currentPage,
        pageSize: pageSize,
        total: totalRequests,
        showSizeChanger: true,
        showTotal: (total: number, range: [number, number]) => t('pagination.showTotal', { from: range[0], to: range[1], total }),
        onChange: onPageChange,
        onShowSizeChange: onPageChange,
    }), [currentPage, pageSize, totalRequests, onPageChange, t]);
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
    const [sorter, setSorter] = useState<SorterResult<RequestSummary>>({}); // Changed type to RequestSummary

    // Removed local state for Drawer visibility and details - now handled by MainLayout

    // Removed fetchData function - now handled by parent (MainLayout)
    // Removed initial fetch useEffect - now handled by parent
    // Removed WebSocket useEffect - now handled by parent

    // Pagination is now handled by parent component via props


    // Handle table changes (pagination, filters, sorter) - memoized
    const handleTableChange = useCallback((
        newPagination: TablePaginationConfig,
        newFilters: Record<string, FilterValue | null>,
        newSorter: SorterResult<RequestSummary> | SorterResult<RequestSummary>[] // Changed type to RequestSummary
    ) => {
        const singleSorter = Array.isArray(newSorter) ? newSorter[0] : newSorter;
        // Update local state for UI feedback
        setFilters(newFilters);
        setSorter(singleSorter);
        // Pagination changes are handled by parent via onPageChange prop
        if (newPagination.current !== currentPage || newPagination.pageSize !== pageSize) {
            onPageChange(newPagination.current || 1, newPagination.pageSize);
        }
    }, [currentPage, pageSize, onPageChange]);

    // Removed handleViewDetails function - now handled by onRow click calling parent's handler

    const handleDelete = useCallback(async (requestId: number) => {
        // setLoading(true); // Loading state now managed by parent
        try {
            await deleteAdminAnalysisRequest(requestId);
            message.success(t('adminRequests.deleteSuccess', { id: requestId }));
            onRefresh(); // Call the passed-in refresh handler from parent
        } catch (error) {
            // Error handled by API message
            // setLoading(false); // Parent handles loading
        }
    }, [onRefresh]);

    const handleRetry = useCallback(async (requestId: number) => {
        // setLoading(true); // Parent handles loading
        try {
            await retryAdminAnalysisRequest(requestId);
            message.success(t('adminRequests.retrySuccess', { id: requestId }));
            onRefresh(); // Refresh list via parent (or rely on WebSocket update)
        } catch (error) {
             // setLoading(false); // Parent handles loading
        }
    }, [onRefresh]);

    // --- Batch Actions - memoized ---
    const handleBatchAction = useCallback(async (action: 'delete' | 'retry') => {
        if (selectedRowKeys.length === 0) {
            message.warning(t('adminRequests.selectRequestsWarning', { action: t(action) }));
            return;
        }
        // setLoading(true); // Parent handles loading
        try {
            await batchAdminRequestAction({
                action: action,
                request_ids: selectedRowKeys as number[],
            });
            message.success(t('adminRequests.batchActionInitiated', { action: t(action), count: selectedRowKeys.length }));
            setSelectedRowKeys([]); // Clear selection after action
            onRefresh(); // Refresh list via parent after batch action (or rely on WebSocket)
        } catch (error) {
            // Error handled by API
            // setLoading(false); // Parent handles loading
        }
    }, [selectedRowKeys, onRefresh]);


    // --- Table Columns - Memoized for performance ---
    // Use t() for column titles
    const columns: ColumnsType<RequestSummary> = useMemo(() => [ // Changed type to RequestSummary
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
            filters: STATUS_OPTIONS.map(status => ({ text: t(`requestStatus.${status}`), value: status })),
            filteredValue: filters.status || null,
            render: (status: RequestStatus) => {
                let color = 'default';
                if (status === 'Completed') color = 'success';
                else if (status === 'Processing') color = 'processing';
                else if (status === 'Failed') color = 'error';
                return <Tag color={color} icon={status === 'Processing' ? <SyncOutlined spin /> : undefined}>{t(`requestStatus.${status}`)}</Tag>;
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
            render: (_: unknown, record: RequestSummary) => {
                const isFailed = record.status === 'Failed';
                return (
                    <Space size="middle">
                        <Popconfirm
                            title={t('requestManagement.deleteConfirm')}
                            onConfirm={() => handleDelete(record.id)}
                            okText={t('confirm')}
                            cancelText={t('cancel')}
                        >
                            <Button icon={<DeleteOutlined />} danger size="small">{t('delete')}</Button>
                        </Popconfirm>
                        {isFailed ? (
                            <Popconfirm
                                title={t('requestManagement.retryConfirm')}
                                onConfirm={() => handleRetry(record.id)}
                                okText={t('confirm')}
                                cancelText={t('cancel')}
                            >
                                <Button icon={<ReloadOutlined />} size="small">{t('retry')}</Button>
                            </Popconfirm>
                        ) : (
                            <Button icon={<ReloadOutlined />} size="small" disabled>{t('retry')}</Button>
                        )}
                    </Space>
                );
            },
            fixed: 'right', // Keep actions visible
            width: 200,
        },
    ], [t, sorter.columnKey, sorter.order, filters.status, handleDelete, handleRetry]);

    // Row selection config - memoized
    const rowSelection = useMemo(() => ({
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    }), [selectedRowKeys]);

    const hasSelected = useMemo(() => selectedRowKeys.length > 0, [selectedRowKeys]);

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
                        title={t('requestManagement.batchDeleteConfirm', { count: selectedRowKeys.length })}
                        disabled={!hasSelected || loading}
                        onConfirm={() => handleBatchAction('delete')}
                        okText={t('confirm')}
                        cancelText={t('cancel')}
                    >
                        <Button type="primary" danger disabled={!hasSelected || loading} loading={loading && false /* Consider separate loading state for batch actions */}>
                            {t('deleteSelected')} {/* Define new key */}
                        </Button>
                    </Popconfirm>
                     <Popconfirm
                        title={t('requestManagement.batchRetryConfirm', { count: selectedRowKeys.length })}
                        disabled={!hasSelected || loading}
                        onConfirm={() => handleBatchAction('retry')}
                        okText={t('confirm')}
                        cancelText={t('cancel')}
                    >
                        <Button type="default" disabled={!hasSelected || loading} loading={loading && false /* Consider separate loading state */}>
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
                dataSource={requests}
                pagination={pagination}
                loading={loading}
                onChange={handleTableChange}
                rowSelection={rowSelection}
                onRow={(record: RequestSummary) => {
                    return {
                        onClick: () => { onOpenDetails(record.id); },
                        style: { cursor: 'pointer' }
                    };
                }}
            />
        </Card>
    );
});

export default RequestManagementPage;