import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, Upload, message, Space, Typography, Card, Divider } from 'antd';
import { UploadOutlined, ClearOutlined, SendOutlined } from '@ant-design/icons';
import type { RcFile, UploadFile, UploadProps } from 'antd/es/upload/interface';

import { createAnalysisRequest } from '../api/requests';
import { SubmissionFormData } from '../types';

const { TextArea } = Input;
const { Title } = Typography;

// Simple file to Base64 conversion
const getBase64 = (file: RcFile): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

interface SubmissionFormProps {
  onSubmissionSuccess?: () => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ onSubmissionSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [imageBase64List, setImageBase64List] = useState<string[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Simple image validation
  const validateImage = (file: File): boolean => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error(t('submissionForm.validation.imageFormatError'));
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error(t('submissionForm.validation.imageSizeError'));
      return false;
    }
    return true;
  };

  // Process uploaded images
  const processImageFile = useCallback(async (file: RcFile): Promise<boolean> => {
    if (!validateImage(file)) {
      return false;
    }

    try {
      const base64 = await getBase64(file);
      const base64Content = base64.split(',')[1]; // Remove data URL prefix
      setImageBase64List(prev => [...prev, base64Content]);
      return true;
    } catch (error) {
      message.error(t('submissionForm.imageProcessingError', { name: file.name }));
      return false;
    }
  }, [t]);

  // Handle file upload changes
  const handleUploadChange: UploadProps['onChange'] = useCallback(async (info) => {
    let newFileList = [...info.fileList];

    // Limit to 5 files
    if (newFileList.length > 5) {
      message.warning(t('submissionForm.validation.maxImagesWarning', { count: 5 }));
      newFileList = newFileList.slice(0, 5);
    }

    // Process new files
    const newBase64List: string[] = [];
    for (const file of newFileList) {
      if (file.originFileObj && file.status !== 'error') {
        const success = await processImageFile(file.originFileObj);
        if (success && file.originFileObj) {
          const base64 = await getBase64(file.originFileObj);
          const base64Content = base64.split(',')[1];
          newBase64List.push(base64Content);
        }
      }
    }

    setFileList(newFileList);
    setImageBase64List(newBase64List);
  }, [processImageFile, t]);

  // Form submission
  const onFinish = async (values: { description: string }) => {
    // Check if user provided either text or images
    if (!values.description?.trim() && imageBase64List.length === 0) {
      message.error(t('submissionForm.validation.emptySubmissionError'));
      return;
    }

    setIsLoading(true);

    const formData: SubmissionFormData = {
      user_prompt: values.description?.trim() || '',
      image_base64_list: imageBase64List,
    };

    try {
      const response = await createAnalysisRequest(formData);
      message.success(t('submissionForm.successMessageWithId', { id: response.id }));
      
      // Clear form
      form.resetFields();
      setImageBase64List([]);
      setFileList([]);
      message.info(t('submissionForm.formCleared'));
      
      onSubmissionSuccess?.();
    } catch (error) {
      console.error('Submission error:', error);
      message.error(t('submissionForm.errorMessage'));
    } finally {
      setIsLoading(false);
    }
  };

  // Clear form
  const handleClear = () => {
    form.resetFields();
    setImageBase64List([]);
    setFileList([]);
    message.info(t('submissionForm.formCleared'));
  };

  const uploadProps: UploadProps = {
    name: 'images',
    multiple: true,
    listType: 'picture-card',
    fileList: fileList,
    maxCount: 5,
    accept: 'image/jpeg,image/png',
    beforeUpload: () => false, // Prevent auto upload
    onChange: handleUploadChange,
  };

  return (
    <Card 
      title={<><SendOutlined /> {t('submissionForm.title')}</>}
      style={{ margin: '20px' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        disabled={isLoading}
      >
        {/* Description/Code Input */}
        <Form.Item
          name="description"
          label={t('submissionForm.unifiedInputLabel')}
          tooltip={t('submissionForm.unifiedInputTooltip')}
        >
          <TextArea
            placeholder={t('submissionForm.unifiedInputPlaceholder')}
            autoSize={{ minRows: 4, maxRows: 8 }}
            size="large"
          />
        </Form.Item>

        <Divider />

        {/* Image Upload */}
        <Form.Item
          label={t('submissionForm.addImageLabel')}
          tooltip={t('submissionForm.addImageTooltip')}
        >
          <Upload {...uploadProps}>
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              border: '1px dashed #d9d9d9',
              borderRadius: '6px',
              background: '#fafafa'
            }}>
              <UploadOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
              <div>{t('submissionForm.uploadText')}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                JPG/PNG, max 2MB each, up to 5 images
              </div>
            </div>
          </Upload>
        </Form.Item>

        {/* Action Buttons */}
        <Form.Item style={{ marginTop: '32px' }}>
          <Space size="middle">
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              size="large"
              icon={<SendOutlined />}
            >
              {isLoading ? t('submissionForm.submitting') : t('submissionForm.submitButton')}
            </Button>
            <Button
              onClick={handleClear}
              disabled={isLoading}
              size="large"
              icon={<ClearOutlined />}
            >
              {t('submissionForm.clearButton')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SubmissionForm;