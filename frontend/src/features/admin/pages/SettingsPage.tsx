import React, { useState, useEffect, useCallback } from 'react'; // Add useCallback
import { Form, Input, Button, Spin, message, Card, Typography, InputNumber, Alert, Tabs, Divider } from 'antd'; // Removed Row, Col; Added Tabs
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { SaveOutlined, UserOutlined, AppstoreOutlined } from '@ant-design/icons'; // Added AppstoreOutlined
import { useNavigate } from 'react-router-dom'; // Import for redirection
import { getSettings, updateSettings } from '../api/settings';
import { updateMyProfile } from '../api/auth'; // Import profile API function
import { useSecureAuth } from '../contexts/SecureAuthContext'; // Use secure auth context
import { AppSettings, AdminUser } from '../../../types/index'; // Import types

const { Title, Text } = Typography;
const { TextArea } = Input;
// TabPane is deprecated, using items prop for Tabs instead

// Define which settings are expected and their types for the form
// This helps with rendering the correct input type and validation
// Add more settings as needed based on backend capabilities
// Define which settings are expected and their types for the form
// Use keys matching the AppSettings interface
// Note: Labels and tooltips will be replaced by t() calls in renderFormItem
const SETTING_DEFINITIONS: Record<keyof AppSettings | string, { type: 'text' | 'number' | 'password' | 'textarea'; required?: boolean }> = {
  openai_api_key: { type: 'password', required: false }, // Not strictly required if already set
  openai_base_url: { type: 'text' },
  openai_model: { type: 'text', required: true },
  system_prompt: { type: 'textarea', required: true },
  max_concurrent_analysis_tasks: { type: 'number', required: true },
  parallel_openai_requests_per_prompt: { type: 'number', required: true }, // Corrected key
  max_total_openai_attempts_per_prompt: { type: 'number', required: true }, // Corrected key
  request_timeout_seconds: { type: 'number', required: true },
  // log_level: { type: 'text' }, // Keep if needed
  // max_analysis_versions: { type: 'number' }, // Keep if needed
};

const SettingsPage: React.FC = () => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const [settingsForm] = Form.useForm(); // Rename form for clarity
  const [profileForm] = Form.useForm(); // Add form for profile
  const navigate = useNavigate(); // Hook for navigation

  // State for App Settings
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Get user from secure auth context
  const { user: adminUser, checkAuth } = useSecureAuth();
  const [profileSaving, setProfileSaving] = useState(false);

  // Combined loading state
  const loading = settingsLoading;

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setSettingsLoading(true);
      try {
        // Fetch settings
        const settingsData = await getSettings();
        setSettings(settingsData);

        // Set initial form values
        settingsForm.setFieldsValue(settingsData);
        if (adminUser) {
          profileForm.setFieldsValue({ admin_username: adminUser.username });
        }

      } catch (error) {
        // Error handled by API functions, maybe add specific handling here if needed
        // Error fetching initial data
        // If profile fetch fails (e.g., 401), App component might handle redirect
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchData();
  }, [settingsForm, profileForm, adminUser]); // Add dependencies

  // Handler for saving App Settings
  const onSettingsFinish = async (values: AppSettings) => {
    setSettingsSaving(true);
    const settingsToUpdate: Partial<AppSettings> = {};

    // Only include changed values, and handle password specifically
    // Iterate over the keys of the submitted values, ensuring type safety
    for (const key of Object.keys(values) as Array<keyof AppSettings>) {
        const formValue = values[key];
        const currentValue = settings ? settings[key] : undefined;

        // Special handling for password field: only update if a new value is entered and not the mask
        if (key === 'openai_api_key') {
            if (formValue && formValue !== '**** MASKED ****') {
                // Use 'as any' to bypass strict type checking for this dynamic assignment
                settingsToUpdate[key] = formValue as any;
            }
        }
        // Handle cases where the setting didn't exist before or has changed
        else if (currentValue === undefined && formValue !== undefined && formValue !== null) {
             // Include if initial settings were null/undefined and value is now present
             // Use 'as any' to bypass strict type checking for this dynamic assignment
             settingsToUpdate[key] = formValue as any;
        } else if (currentValue !== undefined && formValue !== currentValue) {
             // Include other changed values
             // Use 'as any' to bypass strict type checking for this dynamic assignment
             settingsToUpdate[key] = formValue as any;
        }
    }

    if (Object.keys(settingsToUpdate).length === 0) {
        message.info(t('settingsPage.noAppSettingsChanges')); // Define new key
        setSettingsSaving(false);
        return;
    }

    // Updating application settings

    try {
      const updatedSettingsData = await updateSettings(settingsToUpdate);
      setSettings(updatedSettingsData); // Update local state
      // Reset form fields to reflect the saved state (including masking)
      settingsForm.resetFields(); // Use correct form instance
      settingsForm.setFieldsValue(updatedSettingsData); // Use correct form instance
      message.success(t('settingsPage.appSettingsSaveSuccess')); // Define new key
    } catch (error) {
      // Error handled by API function message (already includes message.error)
      // Failed to save application settings
    } finally {
      setSettingsSaving(false);
    }
  };

  // Handler for saving Admin Profile
  const onProfileFinish = async (values: { admin_username?: string; admin_password?: string }) => {
    if (!adminUser) {
      message.error(t('settingsPage.profileUpdateErrorNoUser')); // Define new key
      return;
    }

    setProfileSaving(true);
    const { admin_username: newUsername, admin_password: newPassword } = values;
    const profileUpdatePayload: { username?: string; password?: string } = {};
    let usernameChanged = false;

    // Check if username changed
    if (newUsername && newUsername.trim() !== adminUser.username) {
      profileUpdatePayload.username = newUsername.trim();
      usernameChanged = true;
    }

    // Check if password is provided and not empty/whitespace
    if (newPassword && newPassword.trim()) {
      profileUpdatePayload.password = newPassword.trim();
    }

    if (Object.keys(profileUpdatePayload).length === 0) {
      message.info(t('settingsPage.noProfileChanges')); // Define new key
      setProfileSaving(false);
      // Reset password field even if no changes submitted, for security
      profileForm.resetFields(['admin_password']);
      return;
    }

    // Updating profile

    try {
      const updatedUserData = await updateMyProfile(profileUpdatePayload);
      
      // Refresh auth context to get updated user info
      await checkAuth();

      // Reset form fields: username to new value, password to empty
      profileForm.setFieldsValue({ admin_username: updatedUserData.username });
      profileForm.resetFields(['admin_password']);

      // Handle redirection if username changed
      if (usernameChanged) {
        message.success(t('settingsPage.profileUpdateSuccessUsernameChanged'), 5); // Define new key
        // The secure auth context will handle token invalidation and redirect
        // Just need to wait a bit for the message to show
        setTimeout(() => navigate('/login'), 1500); // Adjust path if needed
      } else {
        message.success(t('settingsPage.profileUpdateSuccess')); // Define new key
      }

    } catch (error) {
      // Error message is shown by the updateMyProfile function
      // Failed to update profile
      // Optionally reset username field back to original if update failed?
      // profileForm.setFieldsValue({ admin_username: adminUser.username });
    } finally {
      setProfileSaving(false);
    }
  };

  // Use t() for labels, tooltips, and validation messages
  const renderFormItem = (key: string, definition: typeof SETTING_DEFINITIONS[string]) => {
    const label = t(`settingsPage.definitions.${key}.label`); // Define nested keys
    const tooltip = t(`settingsPage.definitions.${key}.tooltip`); // Define nested keys
    const requiredMessage = t('settingsPage.validationRequired', { label }); // Define new key

    const rules = definition.required ? [{ required: true, message: requiredMessage }] : [];
    let inputElement: React.ReactNode;

    switch (definition.type) {
      case 'number':
        // Set minimum value to 1 for count/limit fields, 0 could be allowed for others if needed
        const minVal = [
            'max_concurrent_analysis_tasks',
            'openai_parallel_requests_per_prompt',
            'openai_total_attempts_per_prompt',
            'request_timeout_seconds',
            // 'max_analysis_versions' // Uncomment if kept and needs min 1
        ].includes(key) ? 1 : 0;
        inputElement = <InputNumber style={{ width: '100%' }} min={minVal} precision={0} />; // Ensure integer input
        break;
      case 'password':
        // Display masked value initially, allow entering new value
        // Use t() for placeholder
        inputElement = <Input.Password placeholder={t('settingsPage.passwordPlaceholder')} />; // Define new key
        break;
       case 'textarea':
        inputElement = <TextArea rows={6} />;
        break;
      case 'text':
      default:
        inputElement = <Input />;
        break;
    }

    return (
      <Form.Item
        key={key}
        label={label} // Use translated label
        name={key}
        rules={rules}
        tooltip={tooltip} // Use translated tooltip
        // Don't set initialValue for password to avoid showing masked value as placeholder
        // initialValue={definition.type !== 'password' ? settings?.[key] : undefined}
      >
        {inputElement}
      </Form.Item>
    );
  };


  if (loading) {
    // Use t() for Spin tip with proper container
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin size="large" tip={t('settingsPage.loadingConfig')} />
      </div>
    );
  }

  // Basic password validation rule (e.g., min 8 chars) - adjust as needed
  // Use t() for validation message
  const passwordRules = [
    {
      min: 8,
      message: t('settingsPage.passwordMinLengthError'), // Define new key
    },
  ];

  return (
    <Card> {/* Wrap everything in a single Card */}
        <Title level={2} style={{ marginBottom: '24px' }}>{t('settingsPage.title')}</Title>
        <Tabs 
            defaultActiveKey="appSettings" 
            type="line"
            items={[
                {
                    key: "appSettings",
                    label: <span><AppstoreOutlined /> {t('settingsPage.tabApp')}</span>,
                    children: (
                        <>
                <Alert
                    message={t('settingsPage.restartNoteTitle')} // Define new key
                    description={t('settingsPage.restartNoteDescription')} // Define new key
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />
                <Form form={settingsForm} layout="vertical" onFinish={onSettingsFinish}>
                    {Object.entries(SETTING_DEFINITIONS).map(([key, definition]) =>
                        renderFormItem(key, definition) // Existing function reused
                    )}
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={settingsSaving} icon={<SaveOutlined />}>
                            {t('settingsPage.saveAppSettingsButton')} {/* Define new key */}
                        </Button>
                    </Form.Item>
                </Form>
                        </>
                    )
                },
                {
                    key: "profile",
                    label: <span><UserOutlined /> {t('settingsPage.tabProfile')}</span>,
                    children: (
                        adminUser ? (
                            <Form form={profileForm} layout="vertical" onFinish={onProfileFinish} style={{ maxWidth: '500px' }}>
                                <Form.Item
                                    label={t('settingsPage.profileUsernameLabel')}
                                    name="admin_username"
                                    rules={[{ required: true, message: t('settingsPage.profileUsernameRequired') }]}
                                    tooltip={t('settingsPage.profileUsernameTooltip')}
                                >
                                    <Input />
                                </Form.Item>
                                <Form.Item
                                    label={t('settingsPage.profileNewPasswordLabel')}
                                    name="admin_password"
                                    rules={[
                                        {
                                            validator(_, value) {
                                                if (value && value.length < 8) {
                                                    return Promise.reject(new Error(t('settingsPage.passwordMinLengthError')));
                                                }
                                                return Promise.resolve();
                                            },
                                        }
                                    ]}
                                    tooltip={t('settingsPage.profileNewPasswordTooltip')}
                                >
                                    <Input.Password placeholder={t('settingsPage.profileNewPasswordPlaceholder')} />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" loading={profileSaving} icon={<SaveOutlined />}>
                                        {t('settingsPage.saveProfileButton')}
                                    </Button>
                                </Form.Item>
                            </Form>
                        ) : (
                            <Spin tip={t('settingsPage.loadingProfile')} />
                        )
                    )
                }
            ]}
        />
    </Card>
  );
};

export default SettingsPage;