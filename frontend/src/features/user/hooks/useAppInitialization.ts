import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { checkInitializationStatus } from '../api/initialize';

export const useAppInitialization = () => {
  const { t } = useTranslation();
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const status = await checkInitializationStatus();
        setIsInitialized(status.initialized);
      } catch (error) {
        message.error(t('app.checkStatusError'));
        setIsInitialized(null);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, [t]);

  const handleInitializationSuccess = () => {
    setIsInitialized(true);
    setCheckingStatus(false);
    message.success(t('app.initializationSuccess'));
  };

  return {
    isInitialized,
    checkingStatus,
    handleInitializationSuccess,
  };
};