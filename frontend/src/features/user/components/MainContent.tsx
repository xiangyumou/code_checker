import React from 'react';
import { Layout, theme, Row, Col } from 'antd';
import RequestList from './RequestList';
import SubmissionForm from './SubmissionForm';
import type { RequestSummary, AnalysisRequest } from '../../../types/index';

const { Content } = Layout;

interface MainContentProps {
  analysisRequests: RequestSummary[];
  loadingRequests: boolean;
  selectedRequest: AnalysisRequest | null;
  onSelectRequest: (request: RequestSummary) => void;
  onRefresh: () => void;
  onSubmissionSuccess: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  analysisRequests,
  loadingRequests,
  selectedRequest,
  onSelectRequest,
  onRefresh,
  onSubmissionSuccess,
}) => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Content style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
      <Row gutter={[16, 16]} style={{ height: '100%' }}>
        <Col xs={24} sm={24} md={24} lg={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: colorBgContainer, 
            borderRadius: borderRadiusLG, 
            padding: '12px' 
          }}>
            <RequestList
              requests={analysisRequests}
              loading={loadingRequests}
              selectedRequestId={selectedRequest?.id ?? null}
              onSelectRequest={onSelectRequest}
              onRefresh={onRefresh}
            />
          </div>
        </Col>

        <Col xs={24} sm={24} md={24} lg={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              overflowY: 'auto'
            }}
          >
            <SubmissionForm onSubmissionSuccess={onSubmissionSuccess} />
          </div>
        </Col>
      </Row>
    </Content>
  );
};

export default MainContent;