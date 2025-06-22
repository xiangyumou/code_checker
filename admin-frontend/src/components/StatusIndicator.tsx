import React from 'react';
import { Spin, Result } from 'antd';
import { LoadingOutlined, CloseCircleOutlined } from '@ant-design/icons';

interface StatusIndicatorProps {
  status: 'processing' | 'failed' | 'queued'; // Add 'queued' status
  message?: string | null;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, message }) => {
  if (status === 'processing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
          tip="Processing, please wait..." // English for Admin
          size="large"
        />
      </div>
    );
  }

  if (status === 'queued') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin
          tip="Request queued, please wait..." // English for Admin
          size="large"
        />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', padding: '20px' }}>
        <Result
          status="error"
          icon={<CloseCircleOutlined style={{ fontSize: 48 }} />}
          title="Analysis Failed" // English for Admin
          subTitle={message || 'Could not complete analysis. Please check input or try again later.'} // English for Admin
        />
      </div>
    );
  }

  return null; // Should not happen if props are correct
};

export default StatusIndicator;