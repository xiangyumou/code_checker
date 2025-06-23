import React from 'react';
import { Descriptions, Empty, Space, Image as AntdImage, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AnalysisRequest } from '../../../../types/index';

interface OriginalSubmissionTabProps {
  requestData: AnalysisRequest;
}

const OriginalSubmissionTab: React.FC<OriginalSubmissionTabProps> = ({ requestData }) => {
  const { t } = useTranslation();

  return (
    <Descriptions 
      bordered 
      column={1} 
      size="small" 
      style={{ marginTop: 8 }}
      labelStyle={{ fontWeight: 'bold', width: '150px' }}
    >
      <Descriptions.Item label={t('requestDetails.originalSubmissionPrompt')}>
        {requestData.user_prompt ? (
          <div style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word', 
            fontFamily: 'monospace', 
            padding: '8px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '4px' 
          }}>
            {requestData.user_prompt}
          </div>
        ) : (
          <Empty 
            description={t('requestDetails.noPromptProvided')} 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            style={{ margin: '8px 0' }} 
          />
        )}
      </Descriptions.Item>

      {requestData.images_base64 && requestData.images_base64.length > 0 && (
        <Descriptions.Item label={t('requestDetails.originalSubmissionImages')}>
          <AntdImage.PreviewGroup>
            <Space wrap>
              {requestData.images_base64.map((imageBase64: string, index: number) => {
                const imageSrc = `data:image/png;base64,${imageBase64}`;
                return (
                  <AntdImage
                    key={index}
                    width={180}
                    height={180}
                    src={imageSrc}
                    alt={t('requestDetails.submittedImageAlt', { index: index + 1 })}
                    style={{ 
                      border: '1px solid #eee', 
                      objectFit: 'contain', 
                      background: '#f9f9f9', 
                      borderRadius: '4px' 
                    }}
                    preview={{
                      mask: (
                        <div style={{ 
                          background: 'rgba(0, 0, 0, 0.5)', 
                          color: 'white', 
                          textAlign: 'center', 
                          lineHeight: '180px' 
                        }}>
                          {t('requestDetails.previewImage')}
                        </div>
                      ),
                    }}
                    placeholder={
                      <div style={{ 
                        width: 180, 
                        height: 180, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        background: '#f0f0f0', 
                        border: '1px solid #eee', 
                        borderRadius: '4px' 
                      }}>
                        <Spin size="small" />
                      </div>
                    }
                  />
                );
              })}
            </Space>
          </AntdImage.PreviewGroup>
        </Descriptions.Item>
      )}
    </Descriptions>
  );
};

export default OriginalSubmissionTab;