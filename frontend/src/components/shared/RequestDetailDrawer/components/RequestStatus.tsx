import React from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  SyncOutlined, 
  ClockCircleOutlined, 
  QuestionCircleOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import type { RequestStatus as RequestStatusType } from '../../../../types/index';

const { Text } = Typography;

interface RequestStatusProps {
  status: RequestStatusType | undefined;
  isSuccess: boolean | undefined;
  errorMessage?: string | null;
  parsingError?: string | null;
}

const getStatusProps = (
  status: RequestStatusType | undefined, 
  isSuccess: boolean | undefined, 
  t: any
): { color: string; icon: React.ReactNode; text: string } => {
  switch (status) {
    case 'Completed':
      return isSuccess
        ? { color: 'success', icon: <CheckCircleOutlined />, text: t('requestList.completed') }
        : { color: 'error', icon: <CloseCircleOutlined />, text: t('requestDetails.analysisFailed') };
    case 'Processing':
      return { color: 'processing', icon: <SyncOutlined spin />, text: t('requestList.processing') };
    case 'Failed':
      return { color: 'error', icon: <CloseCircleOutlined />, text: t('requestDetails.analysisFailed') };
    case 'Queued':
      return { color: 'default', icon: <ClockCircleOutlined />, text: t('requestList.pending') };
    default:
      return { color: 'default', icon: <QuestionCircleOutlined />, text: t('requestDetails.unknownStatus') };
  }
};

const RequestStatus: React.FC<RequestStatusProps> = ({
  status,
  isSuccess,
  errorMessage,
  parsingError,
}) => {
  const { t } = useTranslation();
  const statusProps = getStatusProps(status, isSuccess, t);

  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Text strong>{t('requestList.status')}:</Text>
      <Tag icon={statusProps.icon} color={statusProps.color} style={{ marginInlineEnd: 0 }}>
        {statusProps.text}
      </Tag>
      
      {/* Show specific error message from request if Failed */}
      {status === 'Failed' && errorMessage && (
        <Tooltip title={errorMessage}>
          <InfoCircleOutlined style={{ color: statusProps.color, cursor: 'help' }} />
        </Tooltip>
      )}
      
      {/* Show parsing error if applicable */}
      {parsingError && status === 'Completed' && (
        <Tag color="warning" icon={<InfoCircleOutlined />}>
          {parsingError}
        </Tag>
      )}
    </div>
  );
};

export default RequestStatus;