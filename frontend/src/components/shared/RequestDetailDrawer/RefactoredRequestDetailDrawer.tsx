import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Descriptions, Button, Space, message, Typography, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  DatabaseOutlined, 
  ExperimentOutlined, 
  ReloadOutlined,
  CloseOutlined 
} from '@ant-design/icons';

// Import hooks
import { useRequestParsing } from './hooks/useRequestParsing';
import { useDiffGeneration } from './hooks/useDiffGeneration';

// Import components
import OriginalSubmissionTab from './components/OriginalSubmissionTab';
import AnalysisResultsTabs from './components/AnalysisResultsTabs';

// Import types
import type { AnalysisRequest } from '../../../types/index';

// Import CSS for diff highlighting
import 'diff2html/bundles/css/diff2html.min.css';
import 'highlight.js/styles/github.css';

const { Title } = Typography;

interface RefactoredRequestDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  requestData: AnalysisRequest | null;
  isLoading: boolean;
  onRegenerateSuccess?: (updatedRequest: AnalysisRequest) => void;
  apiClient: any;
}

const RefactoredRequestDetailDrawer: React.FC<RefactoredRequestDetailDrawerProps> = ({
  open,
  onClose,
  requestData,
  isLoading,
  onRegenerateSuccess,
  apiClient,
}) => {
  const { t } = useTranslation();
  const [activeTopTabKey, setActiveTopTabKey] = useState('original_submission');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Custom hooks for data processing
  const { parsedContent, parsingError } = useRequestParsing(open, requestData);
  const { diffHtml, isDiffLoading } = useDiffGeneration(requestData, parsedContent, parsingError);

  // Reset tab when drawer opens
  useEffect(() => {
    if (open) {
      setActiveTopTabKey('original_submission');
    }
  }, [open]);

  const handleRegenerate = async () => {
    if (!requestData) return;

    setIsRegenerating(true);
    try {
      const regeneratedRequest = await apiClient.post<AnalysisRequest>(
        `/requests/${requestData.id}/regenerate`
      );
      
      message.success(t('requestDetails.regenerateSuccess'));
      onRegenerateSuccess?.(regeneratedRequest);
      onClose();
    } catch (error) {
      message.error(t('requestDetails.regenerateError'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const getDrawerTitle = () => {
    if (!requestData) return t('requestDetails.loading');
    
    return (
      <Space>
        <span>{t('requestDetails.drawerTitle', { id: requestData.id })}</span>
        {requestData.status === 'Failed' && (
          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined />}
            loading={isRegenerating}
            onClick={handleRegenerate}
          >
            {t('requestDetails.regenerate')}
          </Button>
        )}
      </Space>
    );
  };

  const tabItems = [
    {
      key: 'original_submission',
      label: <><DatabaseOutlined /> {t('requestDetails.originalSubmission')}</>,
      children: requestData ? (
        <OriginalSubmissionTab requestData={requestData} />
      ) : (
        <Skeleton active />
      ),
    },
    {
      key: 'analysis_results',
      label: <><ExperimentOutlined /> {t('requestDetails.analysisResults')}</>,
      children: requestData ? (
        <AnalysisResultsTabs
          requestData={requestData}
          parsedContent={parsedContent}
          parsingError={parsingError}
          diffHtml={diffHtml}
          isDiffLoading={isDiffLoading}
        />
      ) : (
        <Skeleton active />
      ),
    },
  ];

  return (
    <Drawer
      title={getDrawerTitle()}
      open={open}
      onClose={onClose}
      width="80%"
      styles={{
        body: { padding: '16px 24px' },
      }}
      closeIcon={<CloseOutlined />}
      destroyOnClose
    >
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          {/* Basic Request Information */}
          {requestData && (
            <Descriptions 
              size="small" 
              style={{ marginBottom: 16 }}
              column={{ xs: 1, sm: 2, md: 3 }}
            >
              <Descriptions.Item label={t('requestDetails.requestId')}>
                {requestData.id}
              </Descriptions.Item>
              <Descriptions.Item label={t('requestDetails.submittedAt')}>
                {new Date(requestData.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('requestDetails.lastUpdated')}>
                {new Date(requestData.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Main Content Tabs */}
          <Tabs
            activeKey={activeTopTabKey}
            onChange={setActiveTopTabKey}
            tabPosition="top"
            items={tabItems}
            style={{ marginTop: 16 }}
          />
        </>
      )}
    </Drawer>
  );
};

export default RefactoredRequestDetailDrawer;