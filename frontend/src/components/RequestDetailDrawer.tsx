import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Card, Empty, Button, Space, Tag, Typography, Alert, Row, Col, Image as AntdImage } from 'antd';
import { FileTextOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import StatusIndicator from './StatusIndicator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AnalysisRequest, RequestStatus } from '../types';
import { regenerateAnalysis } from '../api/requests';

const { Title, Paragraph, Text } = Typography;

interface RequestDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  requestData: AnalysisRequest | null;
  isLoading: boolean;
  onRegenerateSuccess?: (updatedRequest: AnalysisRequest) => void;
}

const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({
  open,
  onClose,
  requestData,
  isLoading,
  onRegenerateSuccess
}) => {
  const { t } = useTranslation();
  const [regenerating, setRegenerating] = useState(false);

  // Simple status display
  const statusConfig = {
    'pending': { icon: <ClockCircleOutlined />, color: 'orange', text: t('requestList.pending') },
    'queued': { icon: <ClockCircleOutlined />, color: 'blue', text: t('requestList.pending') },
    'processing': { icon: <ClockCircleOutlined spin />, color: 'blue', text: t('requestList.processing') },
    'completed': { icon: <CheckCircleOutlined />, color: 'green', text: t('requestList.completed') },
    'failed': { icon: <CloseCircleOutlined />, color: 'red', text: t('requestList.failed') },
  };

  // Simple analysis result extraction
  const analysisResult = useMemo(() => {
    if (!requestData?.gpt_raw_response) {
      return null;
    }

    try {
      const response = JSON.parse(requestData.gpt_raw_response);
      // Look for the main content in various possible fields
      const content = response.analysis || response.result || response.content || response.answer || response.solution;
      
      if (typeof content === 'string') {
        return content;
      }
      
      // If it's an object, try to extract meaningful text
      if (typeof content === 'object' && content !== null) {
        // Look for common fields that contain the main result
        const text = content.explanation || content.answer || content.solution || content.summary || content.description;
        if (text) return text;
      }
      
      // Fallback: try to find any meaningful text in the response
      const fallbackText = response.explanation || response.answer || response.solution || response.summary;
      if (fallbackText) return fallbackText;
      
      return t('requestDetails.analysisCompletedButFailed');
    } catch (error) {
      return requestData.status === 'completed' ? 
        t('requestDetails.parsingErrorEmptyResponse') : 
        requestData.error_message || t('requestDetails.analysisFailed');
    }
  }, [requestData, t]);

  const handleRegenerate = async () => {
    if (!requestData) return;

    setRegenerating(true);
    try {
      const newRequest = await regenerateAnalysis(requestData.id);
      onRegenerateSuccess?.(newRequest);
      onClose();
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const drawerTitle = requestData ? 
    t('requestDetails.drawerTitleWithId', { id: requestData.id }) : 
    t('requestDetails.drawerTitle');

  if (!requestData) {
    return (
      <Drawer
        title={drawerTitle}
        placement="right"
        onClose={onClose}
        open={open}
        width={600}
      >
        <Empty description={t('requestDetails.noDataSelected')} />
      </Drawer>
    );
  }

  const status = requestData.status as RequestStatus;
  const statusInfo = statusConfig[status] || statusConfig['pending'];

  return (
    <Drawer
      title={drawerTitle}
      placement="right"
      onClose={onClose}
      open={open}
      width={600}
      extra={
        <Space>
          <Tag icon={statusInfo.icon} color={statusInfo.color}>
            {statusInfo.text}
          </Tag>
          {status === 'failed' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              size="small"
              loading={regenerating}
              onClick={handleRegenerate}
            >
              {regenerating ? t('requestDetails.regeneratingButton') : t('requestDetails.regenerateButton')}
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Original Submission Section */}
        <Card 
          title={<><FileTextOutlined /> {t('requestDetails.originalSubmission')}</>}
          size="small"
        >
          {requestData.user_prompt ? (
            <Paragraph>
              <Text strong>{t('requestDetails.userPrompt')}:</Text>
              <br />
              <Text style={{ whiteSpace: 'pre-wrap' }}>{requestData.user_prompt}</Text>
            </Paragraph>
          ) : (
            <Text type="secondary">{t('requestDetails.noUserPrompt')}</Text>
          )}

          {requestData.image_paths && requestData.image_paths.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>{t('requestDetails.submittedImages', { count: requestData.image_paths.length })}:</Text>
              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                {requestData.image_paths.map((imagePath, index) => (
                  <Col span={12} key={index}>
                    <AntdImage
                      src={`data:image/jpeg;base64,${imagePath}`}
                      alt={t('requestDetails.submittedImageAlt', { index: index + 1 })}
                      style={{ width: '100%', height: 'auto', borderRadius: 6 }}
                      preview={{ mask: t('requestDetails.previewImage') }}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </Card>

        {/* Analysis Results Section */}
        <Card 
          title={<><CheckCircleOutlined /> {t('requestDetails.analysisResults')}</>}
          size="small"
        >
          {isLoading ? (
            <StatusIndicator status="processing" />
          ) : status === 'processing' || status === 'queued' || status === 'pending' ? (
            <StatusIndicator status={status === 'processing' ? 'processing' : 'queued'} />
          ) : status === 'failed' ? (
            <StatusIndicator 
              status="failed" 
              message={requestData.error_message || undefined}
            />
          ) : status === 'completed' && analysisResult ? (
            <div style={{ 
              background: '#f9f9f9', 
              padding: '16px', 
              borderRadius: '6px',
              border: '1px solid #d9d9d9'
            }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  // Simple styling for markdown content
                  h1: ({children}) => <Title level={4}>{children}</Title>,
                  h2: ({children}) => <Title level={5}>{children}</Title>,
                  h3: ({children}) => <Text strong style={{fontSize: '16px'}}>{children}</Text>,
                  p: ({children}) => <Paragraph style={{marginBottom: '12px'}}>{children}</Paragraph>,
                  code: ({children}) => (
                    <Text code style={{background: '#f0f0f0', padding: '2px 4px'}}>{children}</Text>
                  ),
                  pre: ({children}) => (
                    <div style={{
                      background: '#f6f8fa',
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      marginBottom: '12px'
                    }}>
                      {children}
                    </div>
                  )
                }}
              >
                {analysisResult}
              </ReactMarkdown>
            </div>
          ) : (
            <Alert
              type="info"
              message={t('requestDetails.analysisCompletedButFailed')}
              showIcon
            />
          )}
        </Card>
      </Space>
    </Drawer>
  );
};

export default RequestDetailDrawer;