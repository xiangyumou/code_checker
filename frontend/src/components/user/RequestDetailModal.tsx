import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Tabs, Image, Spin, message } from 'antd';
import { Button } from '../ui/Button';
import { 
  FileTextOutlined,
  CodeOutlined,
  DiffOutlined,
  BulbOutlined,
  ReloadOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { getRequestDetail, regenerateAnalysis } from '@/api/requests';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/shared/lib/utils';
import type { Request } from './RequestList';

interface RequestDetail extends Request {
  user_input?: string;
  uploaded_images?: string[];
  gpt_response?: {
    problem_description?: string;
    io_format?: string;
    io_samples?: Array<{ input: string; output: string }>;
    source_code?: string;
    modified_code?: string;
    modification_analysis?: string;
  };
}

interface RequestDetailModalProps {
  request: Request;
  open: boolean;
  onClose: () => void;
  onRegenerate: () => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  open,
  onClose,
  onRegenerate,
}) => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('submission');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (open && request) {
      fetchDetail();
    }
  }, [open, request]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await getRequestDetail(request.id);
      setDetail(data);
    } catch (error: any) {
      message.error(error.message || t('common.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await regenerateAnalysis(request.id);
      message.success(t('user.messages.regenerateSuccess'));
      onRegenerate();
      fetchDetail();
    } catch (error: any) {
      message.error(error.message || t('user.messages.regenerateError'));
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
      message.success(t('common.copied'));
    } catch {
      message.error(t('common.copyFailed'));
    }
  };

  const renderCodeBlock = (code: string, language: string, id: string) => (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
        icon={copiedCode === id ? <CheckOutlined /> : <CopyOutlined />}
      >
        {copiedCode === id ? t('common.copied') : t('common.copy')}
      </Button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );

  const tabItems = [
    {
      key: 'submission',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          {t('user.detail.originalSubmission')}
        </span>
      ),
      children: loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <div className="space-y-4">
          {detail?.user_input && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('user.detail.userInput')}
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{detail.user_input}</pre>
              </div>
            </div>
          )}
          
          {detail?.uploaded_images && detail.uploaded_images.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('user.detail.uploadedImages')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Image.PreviewGroup>
                  {detail.uploaded_images.map((img, index) => (
                    <Image
                      key={index}
                      src={img}
                      className="rounded-lg object-cover"
                      width={200}
                      height={150}
                    />
                  ))}
                </Image.PreviewGroup>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  if (detail?.gpt_response && request.status === 'completed') {
    const response = detail.gpt_response;
    
    if (response.problem_description) {
      tabItems.push({
        key: 'problem',
        label: (
          <span className="flex items-center gap-2">
            <BulbOutlined />
            {t('user.detail.problemDetails')}
          </span>
        ),
        children: (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeMermaid]}
            >
              {`# ${t('user.detail.problemDescription')}\n\n${response.problem_description}\n\n## ${t('user.detail.ioFormat')}\n\n${response.io_format || t('common.notAvailable')}\n\n## ${t('user.detail.ioSamples')}\n\n${
                response.io_samples?.map((sample, i) => 
                  `### ${t('user.detail.sample')} ${i + 1}\n\n**${t('user.detail.input')}:**\n\`\`\`\n${sample.input}\n\`\`\`\n\n**${t('user.detail.output')}:**\n\`\`\`\n${sample.output}\n\`\`\`\n`
                ).join('\n') || t('common.notAvailable')
              }`}
            </ReactMarkdown>
          </div>
        ),
      });
    }

    if (response.source_code) {
      tabItems.push({
        key: 'source',
        label: (
          <span className="flex items-center gap-2">
            <CodeOutlined />
            {t('user.detail.sourceCode')}
          </span>
        ),
        children: renderCodeBlock(response.source_code, 'cpp', 'source'),
      });
    }

    if (response.modified_code && response.source_code) {
      tabItems.push({
        key: 'diff',
        label: (
          <span className="flex items-center gap-2">
            <DiffOutlined />
            {t('user.detail.codeDiff')}
          </span>
        ),
        children: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('user.detail.original')}
                </h3>
                {renderCodeBlock(response.source_code, 'cpp', 'original')}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('user.detail.modified')}
                </h3>
                {renderCodeBlock(response.modified_code, 'cpp', 'modified')}
              </div>
            </div>
          </div>
        ),
      });
    }

    if (response.modification_analysis) {
      tabItems.push({
        key: 'analysis',
        label: (
          <span className="flex items-center gap-2">
            <BulbOutlined />
            {t('user.detail.modificationAnalysis')}
          </span>
        ),
        children: (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeMermaid]}
            >
              {response.modification_analysis}
            </ReactMarkdown>
          </div>
        ),
      });
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center justify-between pr-8">
          <span>{t('user.detail.title', { id: request.id })}</span>
          {request.status === 'completed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerate}
              loading={regenerating}
              icon={<ReloadOutlined />}
            >
              {t('user.detail.regenerate')}
            </Button>
          )}
        </div>
      }
      width={1000}
      footer={null}
      className="top-8"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="mt-4"
      />
    </Modal>
  );
};