import React, { useMemo } from 'react'; // Added useMemo
import { useOutletContext } from 'react-router-dom'; // Import useOutletContext
import { Card, Typography, Row, Col, Statistic, Spin } from 'antd'; // Added Spin
import { DatabaseOutlined, SyncOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'; // Added CheckCircleOutlined
import { useTranslation } from 'react-i18next';
import { AnalysisRequest } from '../../../types/index'; // Import type

const { Title } = Typography;

// Define the expected context type from MainLayout's Outlet
interface DashboardContext {
  requests: AnalysisRequest[];
  loadingRequests: boolean;
  // Add other context properties if needed later
}


const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const context = useOutletContext<DashboardContext>();

  // Calculate stats based on the requests from context
  const stats = useMemo(() => {
    if (!context || !context.requests) {
      return { total: 0, processing: 0, failed: 0, completed: 0 };
    }
    const { requests } = context;
    return {
      total: requests.length,
      processing: requests.filter(r => r.status === 'Processing').length,
      failed: requests.filter(r => r.status === 'Failed').length,
      completed: requests.filter(r => r.status === 'Completed').length, // Added completed count
    };
  }, [context]);

  if (!context || context.loadingRequests) {
      return (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Spin tip={t('loading')} size="large" />
          </div>
      );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>{t('dashboard.title')}</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card hoverable> {/* Added hoverable */}
            <Statistic
              title={t('dashboard.totalRequests')}
              value={stats.total}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
         <Col xs={24} sm={12} md={8} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.completed')}
              value={stats.completed}
              valueStyle={{ color: 'var(--ant-color-success)' }} // Green for completed
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.processing')}
              value={stats.processing}
              valueStyle={{ color: 'var(--ant-color-processing)' }} // Use theme primary color
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.failed')}
              value={stats.failed}
              valueStyle={{ color: 'var(--ant-color-error)' }} // Use theme error color
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        {/* Add more cards for quick actions or other stats later */}
      </Row>
      {/* Add charts or other components later */}
    </div>
  );
};

export default DashboardPage;