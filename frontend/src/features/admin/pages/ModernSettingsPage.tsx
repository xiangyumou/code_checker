import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Tabs } from 'antd';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  SaveOutlined,
  KeyOutlined,
  SettingOutlined,
  UserOutlined,
  LockOutlined,
  GlobalOutlined,
  ApiOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { getSettings, updateSettings, updateProfile } from '@/api/admin';
import { useSecureAuth } from '../contexts/SecureAuthContext';
import { motion } from 'framer-motion';

interface AppSettings {
  openai_api_key: string;
  openai_base_url: string;
  openai_model_name: string;
  system_prompt: string;
  concurrent_tasks: number;
  request_timeout: number;
}

export const ModernSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useSecureAuth();
  const [activeTab, setActiveTab] = useState('app');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // App settings state
  const [appSettings, setAppSettings] = useState<AppSettings>({
    openai_api_key: '',
    openai_base_url: '',
    openai_model_name: '',
    system_prompt: '',
    concurrent_tasks: 5,
    request_timeout: 300,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Profile settings state
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setAppSettings(data);
    } catch (error: any) {
      message.error(error.message || t('admin.settings.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(appSettings);
      message.success(t('admin.settings.saveSuccess'));
    } catch (error: any) {
      message.error(error.message || t('admin.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (profileData.new_password && profileData.new_password !== profileData.confirm_password) {
      message.error(t('admin.settings.passwordMismatch'));
      return;
    }

    const dataToSend: any = {};
    if (profileData.username && profileData.username !== user?.username) {
      dataToSend.username = profileData.username;
    }
    if (profileData.new_password) {
      dataToSend.current_password = profileData.current_password;
      dataToSend.new_password = profileData.new_password;
    }

    if (Object.keys(dataToSend).length === 0) {
      message.info(t('admin.settings.noChanges'));
      return;
    }

    setSaving(true);
    try {
      await updateProfile(dataToSend);
      message.success(t('admin.settings.profileUpdateSuccess'));
      
      if (dataToSend.username) {
        setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, 1500);
      }
      
      setProfileData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: '',
      }));
    } catch (error: any) {
      message.error(error.message || t('admin.settings.profileUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const tabItems = [
    {
      key: 'app',
      label: (
        <span className="flex items-center gap-2">
          <SettingOutlined />
          {t('admin.settings.appSettings')}
        </span>
      ),
      children: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ApiOutlined />
                {t('admin.settings.openaiConfig')}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  label={t('admin.settings.apiKey')}
                  type={showApiKey ? 'text' : 'password'}
                  value={appSettings.openai_api_key}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, openai_api_key: e.target.value }))}
                  icon={<KeyOutlined />}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
              
              <Input
                label={t('admin.settings.baseUrl')}
                value={appSettings.openai_base_url}
                onChange={(e) => setAppSettings(prev => ({ ...prev, openai_base_url: e.target.value }))}
                icon={<GlobalOutlined />}
                placeholder="https://api.openai.com/v1"
              />
              
              <Input
                label={t('admin.settings.modelName')}
                value={appSettings.openai_model_name}
                onChange={(e) => setAppSettings(prev => ({ ...prev, openai_model_name: e.target.value }))}
                placeholder="gpt-4"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {t('admin.settings.systemConfig')}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label={t('admin.settings.systemPrompt')}
                value={appSettings.system_prompt}
                onChange={(e) => setAppSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
                rows={6}
                placeholder={t('admin.settings.systemPromptPlaceholder')}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('admin.settings.concurrentTasks')}
                  type="number"
                  value={appSettings.concurrent_tasks}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, concurrent_tasks: parseInt(e.target.value) || 1 }))}
                  min={1}
                  max={20}
                />
                
                <Input
                  label={t('admin.settings.requestTimeout')}
                  type="number"
                  value={appSettings.request_timeout}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, request_timeout: parseInt(e.target.value) || 60 }))}
                  min={60}
                  max={600}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              onClick={handleSaveAppSettings}
              loading={saving}
              icon={<SaveOutlined />}
            >
              {t('admin.settings.save')}
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <UserOutlined />
          {t('admin.settings.profile')}
        </span>
      ),
      children: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {t('admin.settings.accountInfo')}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label={t('admin.settings.username')}
                value={profileData.username}
                onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                icon={<UserOutlined />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {t('admin.settings.changePassword')}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  label={t('admin.settings.currentPassword')}
                  type={showPasswords.current ? 'text' : 'password'}
                  value={profileData.current_password}
                  onChange={(e) => setProfileData(prev => ({ ...prev, current_password: e.target.value }))}
                  icon={<LockOutlined />}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPasswords.current ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
              
              <div className="relative">
                <Input
                  label={t('admin.settings.newPassword')}
                  type={showPasswords.new ? 'text' : 'password'}
                  value={profileData.new_password}
                  onChange={(e) => setProfileData(prev => ({ ...prev, new_password: e.target.value }))}
                  icon={<LockOutlined />}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPasswords.new ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
              
              <div className="relative">
                <Input
                  label={t('admin.settings.confirmPassword')}
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={profileData.confirm_password}
                  onChange={(e) => setProfileData(prev => ({ ...prev, confirm_password: e.target.value }))}
                  icon={<LockOutlined />}
                  error={profileData.confirm_password && profileData.new_password !== profileData.confirm_password ? t('admin.settings.passwordMismatch') : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPasswords.confirm ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              onClick={handleUpdateProfile}
              loading={saving}
              icon={<SaveOutlined />}
            >
              {t('admin.settings.updateProfile')}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse space-y-4">
          <div className="h-32 w-96 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          <div className="h-32 w-96 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t('admin.settings.title')}
      </h1>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="[&_.ant-tabs-nav]:bg-transparent [&_.ant-tabs-tab]:text-gray-600 [&_.ant-tabs-tab-active]:text-blue-600"
      />
    </motion.div>
  );
};