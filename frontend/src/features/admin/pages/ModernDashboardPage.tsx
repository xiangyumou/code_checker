import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/Card';
import { 
  DatabaseOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { getDashboardStats } from '@/api/admin';
import { cn } from '@/shared/lib/utils';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardStats {
  total_requests: number;
  completed_requests: number;
  processing_requests: number;
  failed_requests: number;
  trends?: {
    dates: string[];
    total: number[];
    completed: number[];
    failed: number[];
  };
}

export const ModernDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('admin.dashboard.totalRequests'),
      value: stats?.total_requests || 0,
      icon: <DatabaseOutlined />,
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: t('admin.dashboard.completed'),
      value: stats?.completed_requests || 0,
      icon: <CheckCircleOutlined />,
      color: 'green',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-600 dark:text-green-400',
      trend: stats?.total_requests ? ((stats.completed_requests / stats.total_requests) * 100).toFixed(1) + '%' : '0%',
    },
    {
      title: t('admin.dashboard.processing'),
      value: stats?.processing_requests || 0,
      icon: <SyncOutlined className="animate-spin" />,
      color: 'yellow',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      title: t('admin.dashboard.failed'),
      value: stats?.failed_requests || 0,
      icon: <CloseCircleOutlined />,
      color: 'red',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-600 dark:text-red-400',
      trend: stats?.total_requests ? ((stats.failed_requests / stats.total_requests) * 100).toFixed(1) + '%' : '0%',
    },
  ];

  const chartData = {
    labels: stats?.trends?.dates || [],
    datasets: [
      {
        label: t('admin.dashboard.totalRequests'),
        data: stats?.trends?.total || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: t('admin.dashboard.completed'),
        data: stats?.trends?.completed || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: t('admin.dashboard.failed'),
        data: stats?.trends?.failed || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse space-y-4">
          <div className="h-32 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          <div className="h-32 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('admin.dashboard.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('admin.dashboard.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {stat.value.toLocaleString()}
                    </p>
                    {stat.trend && (
                      <div className="flex items-center gap-1 mt-2">
                        {parseFloat(stat.trend) > 50 ? (
                          <RiseOutlined className="text-green-500" />
                        ) : (
                          <FallOutlined className="text-red-500" />
                        )}
                        <span className="text-sm text-gray-500">
                          {stat.trend}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center",
                    stat.bgColor,
                    "border-2",
                    stat.borderColor
                  )}>
                    <span className={cn("text-xl", stat.textColor)}>
                      {stat.icon}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {stats?.trends && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('admin.dashboard.trendsTitle')}
              </h2>
              <div className="h-80">
                <Line data={chartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};