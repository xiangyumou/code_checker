import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Modal } from 'antd';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  ReloadOutlined,
  DeleteOutlined,
  FilterOutlined,
  SearchOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getAdminRequests, deleteRequest, retryRequest } from '@/api/admin';
import { RequestDetailModal } from '@/components/user/RequestDetailModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/shared/lib/utils';
import { formatDate } from '@/shared/lib/utils';
import type { RequestStatus, RequestSummary } from '@/types';

type AdminRequest = RequestSummary & {
  user_input?: string | null;
};

const normalizeStatus = (status: RequestStatus | string): RequestStatus => {
  const normalized = status.toString().toLowerCase();

  switch (normalized) {
    case 'queued':
    case 'pending':
      return 'Queued';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Queued';
  }
};

export const ModernRequestManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<AdminRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  
  const { lastMessage } = useWebSocket();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };
      const response = await getAdminRequests(params);
      const normalizedItems: AdminRequest[] = (response.items || []).map((item: any) => ({
        ...item,
        status: normalizeStatus(item.status),
        error_message: item.error_message ?? null,
        filename: item.filename ?? null,
        user_input: item.user_input ?? null,
      }));
      setRequests(normalizedItems);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error: any) {
      message.error(error.message || t('admin.requests.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, statusFilter, t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!lastMessage?.payload) {
      return;
    }

    if (['request_created', 'request_updated', 'request_deleted', 'status_update'].includes(lastMessage.type)) {
      fetchRequests();
    }
  }, [lastMessage, fetchRequests]);

  const handleDelete = async (ids: number[]) => {
    Modal.confirm({
      title: t('admin.requests.deleteConfirm'),
      content: t('admin.requests.deleteConfirmContent', { count: ids.length }),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await Promise.all(ids.map(id => deleteRequest(id)));
          message.success(t('admin.requests.deleteSuccess'));
          setSelectedRows([]);
          fetchRequests();
        } catch (error: any) {
          message.error(error.message || t('admin.requests.deleteError'));
        }
      },
    });
  };

  const handleRetry = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => retryRequest(id)));
      message.success(t('admin.requests.retrySuccess'));
      setSelectedRows([]);
      fetchRequests();
    } catch (error: any) {
      message.error(error.message || t('admin.requests.retryError'));
    }
  };

  const statusConfig: Record<RequestStatus, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }> = {
    Queued: {
      icon: <ClockCircleOutlined />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    Processing: {
      icon: <SyncOutlined className="animate-spin" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    Completed: {
      icon: <CheckCircleOutlined />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    Failed: {
      icon: <CloseCircleOutlined />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  };

  const statusTranslationKey: Record<RequestStatus, string> = {
    Queued: 'queued',
    Processing: 'processing',
    Completed: 'completed',
    Failed: 'failed',
  };

  const columns = [
    {
      key: 'id',
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      sortable: true,
    },
    {
      key: 'status',
      title: t('admin.requests.status'),
      dataIndex: 'status',
      width: 120,
      render: (status: RequestStatus) => {
        const config = statusConfig[status] ?? statusConfig.Queued;
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            config.bgColor,
            config.color
          )}>
            {config.icon}
            {t(`admin.requests.status.${statusTranslationKey[status]}`)}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      title: t('admin.requests.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (date: string) => formatDate(date),
      sortable: true,
    },
    {
      key: 'updated_at',
      title: t('admin.requests.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (date: string) => formatDate(date),
      sortable: true,
    },
    {
      key: 'filename',
      title: t('admin.requests.filename'),
      dataIndex: 'filename',
      render: (filename: string) => filename || '-',
    },
    {
      key: 'error',
      title: t('admin.requests.error'),
      dataIndex: 'error_message',
      render: (error: string) => error ? (
        <span className="text-red-500 text-sm truncate max-w-xs" title={error}>
          {error}
        </span>
      ) : '-',
    },
    {
      key: 'actions',
      title: t('admin.requests.actions'),
      width: 120,
      align: 'center' as const,
      render: (_: any, record: AdminRequest) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          {record.status === 'Failed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRetry([record.id])}
              icon={<ReloadOutlined />}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete([record.id])}
            icon={<DeleteOutlined />}
            className="text-red-500 hover:text-red-600"
          />
        </div>
      ),
    },
  ];

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      request.id.toString().includes(query) ||
      request.filename?.toLowerCase().includes(query) ||
      request.user_input?.toLowerCase().includes(query)
    );
  });

  const selectedFailedRequests = selectedRows.filter(id =>
    requests.find(r => r.id === id && r.status === 'Failed')
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('admin.requests.title')}
        </h1>
        <Button
          variant="secondary"
          onClick={fetchRequests}
          loading={loading}
          icon={<ReloadOutlined />}
        >
          {t('common.refresh')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Input
                placeholder={t('admin.requests.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<SearchOutlined />}
                className="w-64"
              />
              
              <Dropdown
                items={[
                  { key: 'all', label: t('admin.requests.allStatus'), onClick: () => setStatusFilter('all') },
                  { key: 'queued', label: t('admin.requests.status.queued'), onClick: () => setStatusFilter('Queued') },
                  { key: 'processing', label: t('admin.requests.status.processing'), onClick: () => setStatusFilter('Processing') },
                  { key: 'completed', label: t('admin.requests.status.completed'), onClick: () => setStatusFilter('Completed') },
                  { key: 'failed', label: t('admin.requests.status.failed'), onClick: () => setStatusFilter('Failed') },
                ]}
              >
                <Button variant="secondary" icon={<FilterOutlined />}>
                  {statusFilter === 'all'
                    ? t('admin.requests.allStatus')
                    : t(`admin.requests.status.${statusTranslationKey[statusFilter]}`)}
                </Button>
              </Dropdown>
            </div>

            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('admin.requests.selected', { count: selectedRows.length })}
                </span>
                {selectedFailedRequests.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRetry(selectedFailedRequests)}
                    icon={<ReloadOutlined />}
                  >
                    {t('admin.requests.retrySelected')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(selectedRows)}
                  icon={<DeleteOutlined />}
                  className="text-red-500 hover:text-red-600"
                >
                  {t('admin.requests.deleteSelected')}
                </Button>
              </div>
            )}
          </div>

          <Table
            columns={columns}
            data={filteredRequests}
            rowKey={(record) => record.id}
            loading={loading}
            emptyText={t('admin.requests.empty')}
            onRowClick={setSelectedRequest}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
            }}
          />
        </CardContent>
      </Card>

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          open={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRegenerate={fetchRequests}
        />
      )}
    </div>
  );
};