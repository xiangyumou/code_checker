import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Added Space, Divider, InputNumber, Steps, theme
import { Form, Input, Button, Card, Typography, message, Alert, Space, Divider, InputNumber, Steps, theme } from 'antd'; // Added theme
import { UserOutlined, LockOutlined, KeyOutlined, CloudServerOutlined, CodeOutlined, CheckCircleOutlined, SettingOutlined, NumberOutlined, FieldTimeOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons'; // Added more icons
import { submitInitialization } from '../api/initialize'; // Import the API function

const { Title, Paragraph, Text } = Typography;
const { useToken } = theme; // Now theme is imported correctly

interface InitializationPageProps {
  onInitializationSuccess: () => void; // Callback after successful initialization
}

const InitializationPage: React.FC<InitializationPageProps> = ({ onInitializationSuccess }) => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const { token } = useToken(); // Get theme tokens
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // State to show success message
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // State for current step
  const [allStepsData, setAllStepsData] = useState<any>({}); // State to accumulate data across steps

  // Define steps using translation keys
  const steps = [
      { title: t('initializationPage.steps.adminAccount'), fields: ['username', 'password', 'confirmPassword'] }, // Define new key
      { title: t('initializationPage.steps.apiConfig'), fields: ['openai_api_key', 'openai_base_url', 'openai_model'] }, // Define new key
      { title: t('initializationPage.steps.advancedConfig'), fields: ['system_prompt', 'max_concurrent_analysis_tasks', 'parallel_openai_requests_per_prompt', 'max_total_openai_attempts_per_prompt', 'request_timeout_seconds'] }, // Define new key
  ];

  const onFinish = async (finalStepValues: any) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    // Combine final step data with previously collected data
    // It's crucial to get the latest values from the form for the *final* step
    // as they might not have been stored in allStepsData if the user didn't click "Next"
    // before clicking "Finish". We merge finalStepValues last to ensure they overwrite any stale data.
    const completeData = { ...allStepsData, ...finalStepValues };

    // Password confirmation check using the complete data
    if (completeData.password !== completeData.confirmPassword) {
        setError(t('initializationPage.validation.passwordMismatch'));
        setIsLoading(false);
        return;
    }

    // Construct payload using the complete accumulated data
    const payload = {
        username: completeData.username,
        password: completeData.password,
        openai_api_key: completeData.openai_api_key,
        openai_base_url: completeData.openai_base_url || null,
        openai_model: completeData.openai_model,
        system_prompt: completeData.system_prompt,
        max_concurrent_analysis_tasks: completeData.max_concurrent_analysis_tasks,
        parallel_openai_requests_per_prompt: completeData.parallel_openai_requests_per_prompt,
        max_total_openai_attempts_per_prompt: completeData.max_total_openai_attempts_per_prompt,
        request_timeout_seconds: completeData.request_timeout_seconds,
    };

    try {
      await submitInitialization(payload);
      message.success(t('initializationPage.successMessage')); // Define new key
      setIsSuccess(true); // Set success state to show message in card
      // Optionally delay calling the parent callback to show the success message
      setTimeout(() => {
          onInitializationSuccess();
      }, 1500); // Delay for 1.5 seconds
    } catch (err: any) {
      // Try to extract a more specific error message if available
      const backendError = err?.response?.data?.detail;
      setError(backendError || err.message || t('initializationPage.errorMessageDefault')); // Define new key
      console.error("Initialization error:", err);
    } finally {
      // Don't set loading to false immediately on success, wait for transition
      if (!isSuccess) {
          setIsLoading(false);
      }
    }
};

// Navigation functions
// Navigation functions (Modified handleNext to store data)
const handleNext = async () => {
    try {
        const currentFields = steps[currentStep].fields;
        // Validate and get values for the current step
        const currentValues = await form.validateFields(currentFields);
        setError(null); // Clear previous errors

        // Store current step's data
        setAllStepsData((prevData: Record<string, any>) => ({ ...prevData, ...currentValues }));

        // Move to the next step
        setCurrentStep(currentStep + 1);
    } catch (errorInfo) {
        console.log('Validation Failed:', errorInfo);
        // Antd form shows inline errors
    }
};

const handlePrev = () => {
    setCurrentStep(currentStep - 1);
    setError(null); // Clear errors when moving back
};

// Define initial form values using the defaults from backend schema
const initialValues = {
    openai_model: "gpt-4-turbo",
    system_prompt: "You are a helpful assistant.",
    max_concurrent_analysis_tasks: 5,
    parallel_openai_requests_per_prompt: 5,
    max_total_openai_attempts_per_prompt: 20,
    request_timeout_seconds: 500,
};


return (
    // Use theme background color for consistency
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', background: token.colorBgLayout }}>
        {/* Card will inherit borderRadius from theme */}
        <Card title={<Title level={3} style={{ textAlign: 'center', marginBottom: 0 }}>{t('initializationPage.cardTitle')}</Title>} style={{ width: '100%', maxWidth: 700, boxShadow: token.boxShadowSecondary }}> {/* Define new key */}
            {isSuccess ? (
                // Success State Display - Use theme success color
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircleOutlined style={{ fontSize: '48px', color: token.colorSuccess, marginBottom: '20px' }} />
                <Title level={4} style={{ color: token.colorSuccess }}>{t('initializationPage.successTitle')}</Title> {/* Define new key */}
                <Paragraph type="secondary">{t('initializationPage.successDescription')}</Paragraph> {/* Define new key */}
            </div>
        ) : (
            // Form Display
            <>
                <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: '24px' }}> {/* Use secondary text */}
                    {t('initializationPage.welcomeMessage')} {/* Define new key */}
                </Paragraph>

                {/* Add some vertical space */}
                <Steps current={currentStep} items={steps.map(item => ({ title: item.title }))} style={{ marginBottom: 32, padding: '0 16px' }} />

                {error && <Alert message={error} type="error" showIcon closable style={{ marginBottom: 24 }} onClose={() => setError(null)} />}

                <Form
                    form={form}
                    name="initialization_form"
                    onFinish={onFinish}
                    layout="vertical"
                    requiredMark={false}
                    disabled={isLoading}
                    initialValues={initialValues} // Set initial values
                >
                    {/* Step 0: Admin Account - Conditional Rendering */}
                    {currentStep === 0 && (
                        <div style={{ padding: '0 8px' }}> {/* Removed display:none */}
                            {/* <Divider orientation="left" plain><Title level={5} style={{ margin: 0 }}>{steps[0].title}</Title></Divider> */}
                            <Form.Item
                                name="username"
                                label={t('initializationPage.adminUsernameLabel')}
                                rules={[{ required: true, message: t('initializationPage.validation.usernameRequired') }]}
                            >
                                <Input prefix={<UserOutlined />} placeholder={t('initializationPage.adminUsernamePlaceholder')} size="large" />
                            </Form.Item>
                            <Form.Item
                                name="password"
                                label={t('initializationPage.adminPasswordLabel')}
                                rules={[{ required: true, message: t('initializationPage.validation.passwordRequired') }]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder={t('initializationPage.adminPasswordPlaceholder')} size="large" />
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
                                <Input.Password prefix={<LockOutlined />} placeholder={t('initializationPage.confirmPasswordPlaceholder')} size="large" />
                            </Form.Item>
                        </div>
                    )}

                    {/* Step 1: API Config - Conditional Rendering */}
                    {currentStep === 1 && (
                        <div style={{ padding: '0 8px' }}> {/* Removed display:none */}
                            {/* <Divider orientation="left" plain><Title level={5} style={{ margin: 0 }}>{steps[1].title}</Title></Divider> */}
                            <Form.Item
                                name="openai_api_key"
                                label={t('initializationPage.apiKeyLabel')}
                                rules={[{ required: true, message: t('initializationPage.validation.apiKeyRequired') }]}
                                tooltip={t('initializationPage.apiKeyTooltip')}
                            >
                                <Input.Password prefix={<KeyOutlined />} placeholder="sk-..." size="large" />
                            </Form.Item>
                            <Form.Item
                                name="openai_base_url"
                                label={t('initializationPage.baseUrlLabel')}
                                tooltip={t('initializationPage.baseUrlTooltip')}
                            >
                                <Input prefix={<CloudServerOutlined />} placeholder={t('initializationPage.baseUrlPlaceholder')} size="large" />
                            </Form.Item>
                            <Form.Item
                                name="openai_model"
                                label={t('initializationPage.modelLabel')}
                                rules={[{ required: true, message: t('initializationPage.validation.modelRequired', { defaultValue: 'Model is required.' }) }]} // Added default value for safety
                                tooltip={t('initializationPage.modelTooltip')}
                            >
                                <Input prefix={<CodeOutlined />} placeholder={t('initializationPage.modelPlaceholder')} size="large" />
                            </Form.Item>
                        </div>
                    )}

                    {/* Step 2: Advanced Config - Conditional Rendering */}
                    {currentStep === 2 && (
                        <div style={{ padding: '0 8px' }}> {/* Removed display:none */}
                            {/* <Divider orientation="left" plain><Title level={5} style={{ margin: 0 }}>{steps[2].title}</Title></Divider> */}
                            <Form.Item
                                name="system_prompt"
                                label={t('initializationPage.systemPromptLabel')}
                                rules={[{ required: true, message: t('initializationPage.validation.systemPromptRequired') }]}
                                tooltip={t('initializationPage.systemPromptTooltip')}
                            >
                                <Input.TextArea placeholder={t('initializationPage.systemPromptPlaceholder')} size="large" autoSize={{ minRows: 3, maxRows: 6 }} />
                            </Form.Item>

                            <Form.Item
                                name="max_concurrent_analysis_tasks"
                                label={t('initializationPage.maxConcurrentLabel')}
                                rules={[{ required: true, type: 'number', min: 1, message: t('initializationPage.validation.numberRequired') }]}
                                tooltip={t('initializationPage.maxConcurrentTooltip')}
                            >
                                <InputNumber prefix={<SettingOutlined />} placeholder={t('initializationPage.numberPlaceholder')} size="large" style={{ width: '100%' }} min={1} />
                            </Form.Item>

                            <Form.Item
                                name="parallel_openai_requests_per_prompt"
                                label={t('initializationPage.parallelRequestsLabel')}
                                rules={[{ required: true, type: 'number', min: 1, message: t('initializationPage.validation.numberRequired') }]}
                                tooltip={t('initializationPage.parallelRequestsTooltip')}
                            >
                                <InputNumber prefix={<ThunderboltOutlined />} placeholder={t('initializationPage.numberPlaceholder')} size="large" style={{ width: '100%' }} min={1} />
                            </Form.Item>

                            <Form.Item
                                name="max_total_openai_attempts_per_prompt"
                                label={t('initializationPage.maxAttemptsLabel')}
                                rules={[{ required: true, type: 'number', min: 1, message: t('initializationPage.validation.numberRequired') }]}
                                tooltip={t('initializationPage.maxAttemptsTooltip')}
                            >
                                <InputNumber prefix={<NumberOutlined />} placeholder={t('initializationPage.numberPlaceholder')} size="large" style={{ width: '100%' }} min={1} />
                            </Form.Item>

                            <Form.Item
                                name="request_timeout_seconds"
                                label={t('initializationPage.timeoutLabel')}
                                rules={[{ required: true, type: 'number', min: 1, message: t('initializationPage.validation.numberRequired') }]}
                                tooltip={t('initializationPage.timeoutTooltip')}
                            >
                                <InputNumber prefix={<FieldTimeOutlined />} placeholder={t('initializationPage.numberPlaceholder')} size="large" style={{ width: '100%' }} min={1} />
                            </Form.Item>
                        </div>
                    )}


                    {/* Navigation Buttons */}
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                        {currentStep > 0 && (
                            <Button style={{ minWidth: 100 }} onClick={handlePrev} disabled={isLoading}>
                                {t('initializationPage.buttons.prev')} {/* Define new key */}
                            </Button>
                        )}
                        {/* Placeholder to keep Next/Submit button on the right */}
                        {currentStep === 0 && <div style={{ minWidth: 100 }}></div>}

                        {currentStep < steps.length - 1 && (
                            <Button type="primary" style={{ minWidth: 100 }} onClick={handleNext} loading={isLoading}>
                                {t('initializationPage.buttons.next')} {/* Define new key */}
                            </Button>
                        )}
                        {currentStep === steps.length - 1 && (
                            <Button type="primary" htmlType="submit" style={{ minWidth: 100 }} loading={isLoading}>
                                {t('initializationPage.buttons.finish')} {/* Define new key */}
                            </Button>
                        )}
                    </div>
                </Form>
            </>
        )}
      </Card>
    </div>
  );
};

export default InitializationPage;