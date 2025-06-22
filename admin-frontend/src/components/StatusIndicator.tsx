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

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    padding: '20px',
    textAlign: 'center',
    background: token.colorBgContainerDisabled,
    borderRadius: token.borderRadiusLG,
  };
  if (status === 'processing') {
    return (
      <div style={wrapperStyle}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 36, color: token.colorPrimary }} spin />}
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
          status="error"
          icon={<CloseCircleOutlined style={{ fontSize: 36 }} />}
          title={<span style={{ color: token.colorError }}>{t('statusIndicator.failed')}</span>}
          subTitle={<Paragraph type="secondary">{message || t('statusIndicator.failedMessage')}</Paragraph>}
          style={{ padding: 0 }}
        />
      </div>
    );
  }

  return null; // Should not happen if props are correct
};

export default StatusIndicator;