import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Tabs, Image, Spin, message, Alert } from 'antd';
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
import { getAnalysisRequestDetails, regenerateAnalysis } from '@/features/user/api/requests';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/shared/lib/utils';
import type { RequestSummary, RequestStatus, AnalysisRequest, OrganizedProblem, ModificationAnalysisItem } from '@shared/types';
import { useRequestParsing } from '@/components/shared/RequestDetailDrawer/hooks/useRequestParsing';

interface RequestDetailModalProps {
  request: RequestSummary;
  open: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  initialData?: AnalysisRequest;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  open,
  onClose,
  onRegenerate,
  initialData,
}) => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<AnalysisRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('submission');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { parsedContent, parsingError } = useRequestParsing(open, detail);

  useEffect(() => {
    if (!open || !request) {
      return;
    }

    if (initialData) {
      setDetail(initialData);
      return;
    }

    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, initialData]);

  useEffect(() => {
    if (open) {
      setActiveTab('submission');
    }
  }, [open, request.id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await getAnalysisRequestDetails(request.id);
      setDetail(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : undefined;
      message.error(errorMessage || t('common.errors.fetchFailed'));
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : undefined;
      message.error(errorMessage || t('user.messages.regenerateError'));
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

  const normalizeImageSrc = (base64String: string) => {
    if (base64String.startsWith('data:')) {
      return base64String;
    }
    return `data:image/png;base64,${base64String}`;
  };

  const formatRawResponse = (raw: AnalysisRequest['gpt_raw_response']) => {
    if (!raw) {
      return '';
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed, null, 2);
      } catch (error) {
        return raw;
      }
    }

    try {
      return JSON.stringify(raw, null, 2);
    } catch (error) {
      return String(raw);
    }
  };

  const buildProblemMarkdown = (problem: OrganizedProblem) => {
    const sections: string[] = [];

    sections.push(`# ${t('user.detail.problemDescription')}`);
    sections.push(problem.description || t('common.notAvailable'));

    sections.push(`## ${t('user.detail.ioFormat')}`);
    sections.push(problem.input_format || t('common.notAvailable'));
    sections.push(problem.output_format || t('common.notAvailable'));

    const hasSamples = problem.input_sample || problem.output_sample;
    sections.push(`## ${t('user.detail.ioSamples')}`);

    if (hasSamples) {
      sections.push(
        `### ${t('user.detail.sample')} 1\n\n**${t('user.detail.input')}:**\n\`\`\`\n${
          problem.input_sample || t('common.notAvailable')
        }\n\`\`\`\n\n**${t('user.detail.output')}:**\n\`\`\`\n${
          problem.output_sample || t('common.notAvailable')
        }\n\`\`\``
      );
    } else {
      sections.push(t('common.notAvailable'));
    }

    return sections.filter(Boolean).join('\n\n');
  };

  const renderModificationAnalysis = (analysis: ModificationAnalysisItem[]) => (
    <div className="space-y-6">
      {analysis.map((item, index) => (
        <div
          key={index}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 space-y-3"
        >
          {item.explanation && (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {item.explanation}
            </p>
          )}
          {item.original_snippet && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {t('user.detail.originalCode')}
              </h4>
              {renderCodeBlock(item.original_snippet, 'typescript', `original-${index}`)}
            </div>
          )}
          {item.modified_snippet && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {t('user.detail.modifiedCode')}
              </h4>
              {renderCodeBlock(item.modified_snippet, 'typescript', `modified-${index}`)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const isCompleted = detail?.status === 'Completed';

  const statusToneMap: Record<RequestStatus, string> = {
    Queued: 'text-yellow-600 dark:text-yellow-400',
    Processing: 'text-blue-600 dark:text-blue-400',
    Completed: 'text-green-600 dark:text-green-400',
    Failed: 'text-red-600 dark:text-red-400',
  };

  const statusTranslationKey: Record<RequestStatus, string> = {
    Queued: 'queued',
    Processing: 'processing',
    Completed: 'completed',
    Failed: 'failed',
  };

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
          {detail?.user_prompt && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('user.detail.userInput')}
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{detail.user_prompt}</pre>
              </div>
            </div>
          )}

          {detail?.images_base64 && detail.images_base64.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('user.detail.uploadedImages')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Image.PreviewGroup>
                  {detail.images_base64.map((img, index) => (
                    <Image
                      key={index}
                      src={normalizeImageSrc(img)}
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

  if (isCompleted) {
    if (parsingError) {
      tabItems.push({
        key: 'analysis-error',
        label: (
          <span className="flex items-center gap-2">
            <DiffOutlined />
            {t('user.detail.modificationAnalysis')}
          </span>
        ),
        children: (
          <Alert
            type="error"
            message={parsingError}
            showIcon
          />
        ),
      });
    } else if (parsedContent) {
      if (parsedContent.organized_problem) {
        const problemContent =
          typeof parsedContent.organized_problem === 'string'
            ? parsedContent.organized_problem
            : buildProblemMarkdown(parsedContent.organized_problem as OrganizedProblem);

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
                {problemContent}
              </ReactMarkdown>
            </div>
          ),
        });
      }

      if (parsedContent.modification_analysis && parsedContent.modification_analysis.length > 0) {
        tabItems.push({
          key: 'analysis',
          label: (
            <span className="flex items-center gap-2">
              <DiffOutlined />
              {t('user.detail.modificationAnalysis')}
            </span>
          ),
          children: renderModificationAnalysis(parsedContent.modification_analysis as ModificationAnalysisItem[]),
        });
      }

      if (parsedContent.original_code) {
        tabItems.push({
          key: 'original-code',
          label: (
            <span className="flex items-center gap-2">
              <CodeOutlined />
              {t('user.detail.originalCode')}
            </span>
          ),
          children: renderCodeBlock(
            parsedContent.original_code as string,
            'typescript',
            'original-code'
          ),
        });
      }

      if (parsedContent.modified_code) {
        tabItems.push({
          key: 'modified-code',
          label: (
            <span className="flex items-center gap-2">
              <CodeOutlined />
              {t('user.detail.modifiedCode')}
            </span>
          ),
          children: renderCodeBlock(
            parsedContent.modified_code as string,
            'typescript',
            'modified-code'
          ),
        });
      }
    }
  }

  if (detail?.gpt_raw_response) {
    tabItems.push({
      key: 'raw-response',
      label: (
        <span className="flex items-center gap-2">
          <CodeOutlined />
          {t('requestDetails.rawResponse')}
        </span>
      ),
      children: (
        <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
          {formatRawResponse(detail.gpt_raw_response)}
        </pre>
      ),
    });
  }

  return (
    <Modal
      title={
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">
              {t('user.detail.title', { id: request.id })}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('user.detail.status')}:{' '}
              <span className={cn(
                'font-medium',
                statusToneMap[request.status] ?? 'text-blue-600 dark:text-blue-400'
              )}>
                {t(`requestList.${statusTranslationKey[request.status] ?? 'processing'}`)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchDetail}
              disabled={loading || regenerating}
            >
              {t('common.refresh')}
            </Button>
            <Button
              variant="primary"
              onClick={handleRegenerate}
              loading={regenerating}
              icon={<ReloadOutlined />}
            >
              {t('user.detail.regenerate')}
            </Button>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      className="max-w-5xl"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};
