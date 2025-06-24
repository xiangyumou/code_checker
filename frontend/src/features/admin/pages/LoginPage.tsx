import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { UserOutlined, LockOutlined } from '@ant-design/icons';
// Login is now handled through SecureAuthContext

const { Title } = Typography;

interface LoginPageProps {
  onLoginSuccess: (username: string, password: string) => Promise<{ success: boolean; error?: string }>; // Callback for login
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      // Call the secure login callback provided by App.tsx
      const result = await onLoginSuccess(values.username, values.password);
      if (!result.success) {
        setError(result.error || t('loginPage.errorMessage'));
      }
    } catch (err: unknown) {
      // Use t() for default error message
      setError(err instanceof Error ? err.message : t('loginPage.errorMessage'));
      console.error("Login page error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Card style={{ width: 350 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>{t('loginPage.title')}</Title>
        </div>
        {/* Use t() for Alert message if error is the default one */}
        {error && <Alert message={error === t('loginPage.errorMessage') ? t('loginPage.errorMessage') : error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form
          form={form}
          name="admin_login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: t('loginPage.usernameRequired') }]} // Define new key
          >
            <Input prefix={<UserOutlined />} placeholder={t('loginPage.username')} />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: t('loginPage.passwordRequired') }]} // Define new key
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('loginPage.password')} />
          </Form.Item>
          {/* Add "Remember me" checkbox if needed */}
          {/* <Form.Item>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Remember me</Checkbox>
            </Form.Item>
            <a style={{ float: 'right' }} href="">
              Forgot password
            </a>
          </Form.Item> */}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} style={{ width: '100%' }}>
              {t('loginPage.login')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;