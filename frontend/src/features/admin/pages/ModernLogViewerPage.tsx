import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Modal, DatePicker } from 'antd';
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
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  BugOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { getLogs, clearLogs } from '@/api/admin';
import { cn } from '@/shared/lib/utils';
import { formatDate } from '@/shared/lib/utils';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface LogEntry {
  id: number;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  timestamp: string;
  source: string;
  message: string;
}

export const ModernLogViewerPage: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize, levelFilter, dateRange]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...(levelFilter !== 'all' && { level: levelFilter }),
        ...(dateRange[0] && { start_date: dateRange[0].format('YYYY-MM-DD') }),
        ...(dateRange[1] && { end_date: dateRange[1].format('YYYY-MM-DD') }),
      };
      const response = await getLogs(params);
      setLogs(response.items || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error: any) {
      message.error(error.message || t('admin.logs.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    Modal.confirm({
      title: t('admin.logs.clearConfirm'),
      content: t('admin.logs.clearConfirmContent'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await clearLogs();
          message.success(t('admin.logs.clearSuccess'));
          fetchLogs();
        } catch (error: any) {
          message.error(error.message || t('admin.logs.clearError'));
        }
      },
    });
  };

  const levelConfig = {
    DEBUG: {
      icon: <BugOutlined />,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    },
    INFO: {
      icon: <InfoCircleOutlined />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    WARNING: {
      icon: <WarningOutlined />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    ERROR: {
      icon: <CloseCircleOutlined />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  };

  const columns = [
    {
      key: 'level',
      title: t('admin.logs.level'),
      dataIndex: 'level',
      width: 100,
      render: (level: string) => {
        const config = levelConfig[level as keyof typeof levelConfig];
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            config.bgColor,
            config.color
          )}>
            {config.icon}
            {level}
          </span>
        );
      },
    },
    {
      key: 'timestamp',
      title: t('admin.logs.timestamp'),
      dataIndex: 'timestamp',
      width: 180,
      render: (timestamp: string) => formatDate(timestamp),
      sortable: true,
    },
    {
      key: 'source',
      title: t('admin.logs.source'),
      dataIndex: 'source',
      width: 150,
      render: (source: string) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {source}
        </span>
      ),
    },
    {
      key: 'message',
      title: t('admin.logs.message'),
      dataIndex: 'message',
      render: (message: string) => (
        <div className="text-sm text-gray-700 dark:text-gray-300 max-w-2xl">
          <p className="truncate" title={message}>
            {message}
          </p>
        </div>
      ),
    },
  ];

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.source.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('admin.logs.title')}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchLogs}
            loading={loading}
            icon={<ReloadOutlined />}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleClearLogs}
            icon={<DeleteOutlined />}
            className="text-red-500 hover:text-red-600"
          >
            {t('admin.logs.clearAll')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Input
              placeholder={t('admin.logs.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<SearchOutlined />}
              className="w-64"
            />
            
            <Dropdown
              items={[
                { key: 'all', label: t('admin.logs.allLevels'), onClick: () => setLevelFilter('all') },
                { key: 'DEBUG', label: 'DEBUG', icon: <BugOutlined />, onClick: () => setLevelFilter('DEBUG') },
                { key: 'INFO', label: 'INFO', icon: <InfoCircleOutlined />, onClick: () => setLevelFilter('INFO') },
                { key: 'WARNING', label: 'WARNING', icon: <WarningOutlined />, onClick: () => setLevelFilter('WARNING') },
                { key: 'ERROR', label: 'ERROR', icon: <CloseCircleOutlined />, onClick: () => setLevelFilter('ERROR') },
              ]}
            >
              <Button variant="secondary" icon={<FilterOutlined />}>
                {levelFilter === 'all' ? t('admin.logs.allLevels') : levelFilter}
              </Button>
            </Dropdown>
            
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              placeholder={[t('admin.logs.startDate'), t('admin.logs.endDate')]}
              className="w-auto"
            />
          </div>

          <Table
            columns={columns}
            data={filteredLogs}
            rowKey={(record) => record.id}
            loading={loading}
            emptyText={t('admin.logs.empty')}
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
    </div>
  );
};