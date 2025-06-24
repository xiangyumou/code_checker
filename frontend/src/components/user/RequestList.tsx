import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  FileTextOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { cn } from '@/shared/lib/utils';
import { formatDate } from '@/shared/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Empty } from 'antd';

export interface Request {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  error_message?: string;
}

interface RequestListProps {
  requests: Request[];
  loading: boolean;
  onRefresh: () => void;
  onRequestClick: (request: Request) => void;
}

const statusConfig = {
  pending: {
    icon: <ClockCircleOutlined />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Pending',
  },
  processing: {
    icon: <LoadingOutlined className="animate-spin" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Processing',
  },
  completed: {
    icon: <CheckCircleOutlined />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Completed',
  },
  failed: {
    icon: <CloseCircleOutlined />,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Failed',
  },
};

export const RequestList: React.FC<RequestListProps> = ({
  requests,
  loading,
  onRefresh,
  onRequestClick,
}) => {
  const { t } = useTranslation();

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingOutlined className="text-3xl text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t('user.requests.title')}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={loading}
          icon={<ReloadOutlined />}
        >
          {t('common.refresh')}
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12">
          <Empty
            description={t('user.requests.empty')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3">
            {requests.map((request, index) => {
              const config = statusConfig[request.status];
              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    interactive
                    className={cn(
                      "group cursor-pointer transition-all duration-200",
                      "hover:shadow-lg hover:scale-[1.01]"
                    )}
                    onClick={() => onRequestClick(request)}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-xl",
                        "border-2 transition-all duration-200",
                        config.bgColor,
                        config.borderColor,
                        "group-hover:scale-110"
                      )}>
                        <span className={cn("text-xl", config.color)}>
                          {config.icon}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileTextOutlined className="text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {t('user.requests.request')} #{request.id}
                          </span>
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            config.bgColor,
                            config.color
                          )}>
                            {t(`user.requests.status.${request.status}`)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{formatDate(request.created_at)}</span>
                          {request.error_message && (
                            <span className="text-red-500 truncate">
                              {request.error_message}
                            </span>
                          )}
                        </div>
                      </div>

                      <RightOutlined className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};