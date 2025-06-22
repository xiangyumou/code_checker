import React from 'react';
import { Spin, Result, theme, Typography } from 'antd';
import { LoadingOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { useToken } = theme;
const { Paragraph } = Typography;

interface StatusIndicatorProps {
  status: 'processing' | 'failed' | 'queued'; // Add 'queued' status
  message?: string | null;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, message }) => {
  const { token } = useToken();
  const { t } = useTranslation();

  // Common style for the wrapper div
  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column', // Stack icon/spin and text vertically
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px', // Keep min height to fill space
    padding: '20px',
    textAlign: 'center',
    background: token.colorBgContainerDisabled, // Use a subtle background
    borderRadius: token.borderRadiusLG,
  };

  if (status === 'processing') {
    return (
      <div style={wrapperStyle}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 36, color: token.colorPrimary }} spin />} // Smaller icon, use primary color
          size="large"
        />
        <Paragraph style={{ marginTop: '16px', color: token.colorTextSecondary }}>
          {message || t('statusIndicator.processing')}
        </Paragraph>
      </div>
    );
  }

  if (status === 'queued') {
    return (
      <div style={wrapperStyle}>
         {/* Use an icon instead of Spin for queued state */}
         <ClockCircleOutlined style={{ fontSize: 36, color: token.colorTextSecondary, marginBottom: '16px' }} />
         <Paragraph style={{ color: token.colorTextSecondary }}>
           {message || t('statusIndicator.queued')}
         </Paragraph>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={wrapperStyle}>
        <Result
          status="error" // This will use token.colorError internally
          icon={<CloseCircleOutlined style={{ fontSize: 36 }} />} // Slightly smaller icon
          title={<span style={{ color: token.colorError }}>{t('statusIndicator.failed')}</span>}
          subTitle={<Paragraph type="secondary">{message || t('statusIndicator.failedMessage')}</Paragraph>}
          style={{ padding: 0 }} // Remove default Result padding
        />
      </div>
    );
  }

  return null; // Return null for unhandled or completed states
};

export default StatusIndicator;