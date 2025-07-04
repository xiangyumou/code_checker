import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { SubmissionForm } from '@/components/user/SubmissionForm';
import { RequestList, type Request } from '@/components/user/RequestList';
import { useRequests } from '@/hooks/useRequests';
import { useWebSocket } from '@/hooks/useWebSocket';
import { createRequest } from '@/api/requests';
import { RequestDetailModal } from '@/components/user/RequestDetailModal';
import { motion } from 'framer-motion';

export const UserApp: React.FC = () => {
  const { t } = useTranslation();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { requests, loading, refetch } = useRequests();
  const { isConnected, lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage) {
      refetch();
    }
  }, [lastMessage, refetch]);

  const handleSubmit = useCallback(async (data: { text: string; images: string[] }) => {
    setSubmitting(true);
    try {
      await createRequest(data);
      message.success(t('user.messages.submitSuccess'));
      refetch();
    } catch (error: any) {
      message.error(error.message || t('user.messages.submitError'));
    } finally {
      setSubmitting(false);
    }
  }, [t, refetch]);

  return (
    <AppShell
      header={
        <Header 
          showWebSocketStatus 
          isConnected={isConnected}
        />
      }
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('user.welcome.title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {t('user.welcome.subtitle')}
            </p>
          </div>
          
          <SubmissionForm 
            onSubmit={handleSubmit} 
            loading={submitting} 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <RequestList
            requests={requests}
            loading={loading}
            onRefresh={refetch}
            onRequestClick={setSelectedRequest}
          />
        </motion.div>
      </div>

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          open={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRegenerate={() => refetch()}
        />
      )}
    </AppShell>
  );
};