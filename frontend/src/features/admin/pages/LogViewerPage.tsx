import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Tag, 
  DatePicker, 
  Select, 
  Input, 
  Space, 
  Button, 
  Card,
  Popconfirm,
  message,
  Tooltip,
  Typography
} from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { Log, LogLevel, LogQueryParams } from '../../../types';
import { getLogs, clearAllLogs } from '../api/logs';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Title } = Typography;

const LogViewerPage: React.FC = () => {
  const { t } = useTranslation();
  
  // State for logs data
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // State for filters and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [levelFilter, setLevelFilter] = useState<LogLevel | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch logs function
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: LogQueryParams = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        level: levelFilter,
        search: searchTerm || undefined,
        start_date: dateRange?.[0]?.toISOString(),
        end_date: dateRange?.[1]?.toISOString(),
      };
      
      const result = await getLogs(params);
      setLogs(result.items);
      setTotal(result.total);
    } catch (error) {
      // Error already handled by API function
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, levelFilter, dateRange, searchTerm]);
  
  // Fetch logs on component mount and when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [levelFilter, dateRange, searchTerm]);
  
  // Handle clear all logs
  const handleClearAllLogs = async () => {
    try {
      await clearAllLogs();
      fetchLogs();
    } catch (error) {
      // Error already handled by API function
    }
  };
  
  // Get tag color based on log level
  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'DEBUG':
        return 'blue';
      case 'INFO':
        return 'green';
      case 'WARNING':
        return 'orange';
      case 'ERROR':
        return 'red';
      default:
        return 'default';
    }
  };
  
  // Table columns definition
  const columns: ColumnsType<Log> = [
    {
      title: t('admin.logs.level'),
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: LogLevel) => (
        <Tag color={getLogLevelColor(level)}>
          {level}
        </Tag>
      ),
    },
    {
      title: t('admin.logs.timestamp'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('admin.logs.source'),
      dataIndex: 'source',
      key: 'source',
      width: 200,
      ellipsis: true,
      render: (source: string | null) => source || '-',
    },
    {
      title: t('admin.logs.message'),
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Tooltip title={message}>
          <span>{message}</span>
        </Tooltip>
      ),
    },
  ];
  
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('admin.logs.title')}</Title>
      
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder={t('admin.logs.filterByLevel')}
              allowClear
              value={levelFilter}
              onChange={setLevelFilter}
            >
              <Select.Option value="DEBUG">DEBUG</Select.Option>
              <Select.Option value="INFO">INFO</Select.Option>
              <Select.Option value="WARNING">WARNING</Select.Option>
              <Select.Option value="ERROR">ERROR</Select.Option>
            </Select>
            
            <RangePicker
              showTime
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              placeholder={[t('admin.logs.startDate'), t('admin.logs.endDate')]}
            />
            
            <Search
              placeholder={t('admin.logs.searchPlaceholder')}
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={(value) => setSearchTerm(value)}
            />
            
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchLogs}
              loading={loading}
            >
              {t('admin.logs.refresh')}
            </Button>
            
            <Popconfirm
              title={t('admin.logs.clearConfirmTitle')}
              description={t('admin.logs.clearConfirmDescription')}
              onConfirm={handleClearAllLogs}
              okText={t('common.yes')}
              cancelText={t('common.no')}
              okButtonProps={{ danger: true }}
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
              >
                {t('admin.logs.clearAll')}
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>
      
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => t('admin.logs.totalCount', { count: total }),
          pageSizeOptions: ['20', '50', '100', '200'],
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size || 50);
          },
        }}
        scroll={{ x: 800 }}
      />
    </div>
  );
};

export default LogViewerPage;