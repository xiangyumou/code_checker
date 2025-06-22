import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, Card, Typography, message, Alert, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { submitInitialization } from '../api/initialize';

const { Title, Paragraph } = Typography;

interface InitializationPageProps {
  onInitializationSuccess: () => void;
}

const InitializationPage: React.FC<InitializationPageProps> = ({ onInitializationSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: any) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    // Password confirmation check
    if (values.password !== values.confirmPassword) {
        setError(t('initializationPage.validation.passwordMismatch'));
        setIsLoading(false);
        return;
    }

    // Simple payload with sensible defaults
    const payload = {
        username: values.username,
        password: values.password,
        openai_api_key: values.openai_api_key,
        openai_base_url: values.openai_base_url || null,
        openai_model: values.openai_model || 'gpt-3.5-turbo',
        system_prompt: 'You are a helpful code analysis assistant that reviews code and provides feedback.',
        max_concurrent_analysis_tasks: 3,
        parallel_openai_requests_per_prompt: 1,
        max_total_openai_attempts_per_prompt: 2,
        request_timeout_seconds: 60,
    };

    try {
      await submitInitialization(payload);
      message.success(t('initializationPage.successMessage'));
      setIsSuccess(true);
      setTimeout(() => {
          onInitializationSuccess();
      }, 1500);
    } catch (err: any) {
      const backendError = err?.response?.data?.detail;
      setError(backendError || err.message || t('initializationPage.errorMessageDefault'));
      console.error("Initialization error:", err);
    } finally {
      if (!isSuccess) {
          setIsLoading(false);
      }
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      padding: '20px',
      background: '#f5f5f5'
    }}>
      <Card 
        title={
          <Title level={3} style={{ textAlign: 'center', marginBottom: 0 }}>
            {t('initializationPage.cardTitle')}
          </Title>
        } 
        style={{ width: '100%', maxWidth: 500 }}
      >
        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '20px' }} />
            <Title level={4} style={{ color: '#52c41a' }}>
              {t('initializationPage.successTitle')}
            </Title>
            <Paragraph type="secondary">
              {t('initializationPage.successDescription')}
            </Paragraph>
          </div>
        ) : (
          <>
            <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: '24px' }}>
              Setup your admin account and OpenAI API to get started.
            </Paragraph>

            {error && (
              <Alert 
                message={error} 
                type="error" 
                showIcon 
                closable 
                style={{ marginBottom: 24 }} 
                onClose={() => setError(null)} 
              />
            )}

            <Form
              form={form}
              name="initialization_form"
              onFinish={onFinish}
              layout="vertical"
              requiredMark={false}
              disabled={isLoading}
              initialValues={{
                openai_model: 'gpt-3.5-turbo'
              }}
            >
              <Divider orientation="left" plain>Admin Account</Divider>
              
              <Form.Item
                name="username"
                label={t('initializationPage.adminUsernameLabel')}
                rules={[{ required: true, message: t('initializationPage.validation.usernameRequired') }]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder={t('initializationPage.adminUsernamePlaceholder')} 
                  size="large" 
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={t('initializationPage.adminPasswordLabel')}
                rules={[{ required: true, message: t('initializationPage.validation.passwordRequired') }]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder={t('initializationPage.adminPasswordPlaceholder')} 
                  size="large" 
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={t('initializationPage.confirmPasswordLabel')}
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: t('initializationPage.validation.confirmPasswordRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('initializationPage.validation.passwordMismatch')));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder={t('initializationPage.confirmPasswordPlaceholder')} 
                  size="large" 
                />
              </Form.Item>

              <Divider orientation="left" plain>OpenAI Configuration</Divider>

              <Form.Item
                name="openai_api_key"
                label={t('initializationPage.apiKeyLabel')}
                rules={[{ required: true, message: t('initializationPage.validation.apiKeyRequired') }]}
                tooltip={t('initializationPage.apiKeyTooltip')}
              >
                <Input.Password 
                  prefix={<KeyOutlined />} 
                  placeholder="sk-..." 
                  size="large" 
                />
              </Form.Item>

              <Form.Item
                name="openai_base_url"
                label={t('initializationPage.baseUrlLabel')}
                tooltip={t('initializationPage.baseUrlTooltip')}
              >
                <Input 
                  placeholder={t('initializationPage.baseUrlPlaceholder')} 
                  size="large" 
                />
              </Form.Item>

              <Form.Item
                name="openai_model"
                label={t('initializationPage.modelLabel')}
                tooltip={t('initializationPage.modelTooltip')}
              >
                <Input 
                  placeholder={t('initializationPage.modelPlaceholder')} 
                  size="large" 
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 32 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={isLoading} 
                  size="large"
                  block
                >
                  {t('initializationPage.buttons.finish')}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default InitializationPage;