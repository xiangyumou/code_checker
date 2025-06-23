import React from 'react';
import { Spin, Result, theme, Typography } from 'antd'; // Added theme, Typography
import { LoadingOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'; // Added ClockCircleOutlined

const { useToken } = theme; // Import useToken
const { Paragraph } = Typography; // Import Paragraph

interface StatusIndicatorProps {
  status: 'processing' | 'failed' | 'queued'; // Add 'queued' status
  message?: string | null;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, message }) => {
  const { token } = useToken(); // Get theme tokens

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
          {message || "正在处理中，请稍候..."}
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
           {message || "请求已加入队列，等待处理..."}
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
          title={<span style={{ color: token.colorError }}>分析失败</span>} // Explicitly color title
          subTitle={<Paragraph type="secondary">{message || '无法完成分析，请检查输入或稍后重试。'}</Paragraph>}
          style={{ padding: 0 }} // Remove default Result padding
        />
      </div>
    );
  }

  return null; // Return null for unhandled or completed states
};

export default StatusIndicator;