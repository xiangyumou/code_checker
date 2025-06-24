import React, { useState } from 'react';
import { Tabs, Empty, Card, Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FileTextOutlined, DiffOutlined, CodeOutlined, CopyOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import DOMPurify from 'dompurify';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { useTheme } from '../../../../contexts/ThemeContext';
import RequestStatus from './RequestStatus';
import type { AnalysisRequest, OrganizedProblem, ModificationAnalysisItem } from '../../../../types/index';

const { Text } = Typography;

interface GptResponseContent {
  organized_problem?: OrganizedProblem | null;
  modified_code?: string | null;
  modification_analysis?: ModificationAnalysisItem[] | null;
  original_code?: string | null;
}

interface AnalysisResultsTabsProps {
  requestData: AnalysisRequest;
  parsedContent: GptResponseContent | null;
  parsingError: string | null;
  diffHtml: string | null;
  isDiffLoading: boolean;
}

const AnalysisResultsTabs: React.FC<AnalysisResultsTabsProps> = ({
  requestData,
  parsedContent,
  parsingError,
  diffHtml,
  isDiffLoading,
}) => {
  const { t } = useTranslation();
  const { effectiveTheme } = useTheme();
  const [activeAnalysisTabKey, setActiveAnalysisTabKey] = useState('problem');

  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a success message here
    } catch (error) {
      // Handle copy error
    }
  };

  const renderMarkdownContent = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeMermaid]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <pre style={{ background: 'var(--card-bg-color)', padding: '16px', borderRadius: '6px', overflow: 'auto' }}>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className={className} {...props} style={{ background: 'var(--card-bg-color)', padding: '2px 4px', borderRadius: '3px' }}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const analysisTabItems = [
    {
      key: 'problem',
      label: <><FileTextOutlined /> {t('requestDetails.problemAnalysis')}</>,
      children: (
        <Card size="small" style={{ marginTop: 8 }}>
          {parsedContent?.organized_problem ? (
            renderMarkdownContent(
              typeof parsedContent.organized_problem === 'string'
                ? parsedContent.organized_problem
                : JSON.stringify(parsedContent.organized_problem, null, 2)
            )
          ) : (
            <Empty 
              description={t('requestDetails.noProblemAnalysis')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
            />
          )}
        </Card>
      ),
    },
    {
      key: 'diff',
      label: <><DiffOutlined /> {t('requestDetails.codeDiff')}</>,
      children: (
        <Card size="small" style={{ marginTop: 8 }}>
          {isDiffLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text>{t('requestDetails.generatingDiff')}</Text>
            </div>
          ) : diffHtml ? (
            <div 
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(diffHtml, {
                ALLOWED_TAGS: ['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'thead', 'pre', 'code', 'ins', 'del', 'strong', 'em', 'b', 'i'],
                ALLOWED_ATTR: ['class', 'style', 'data-line-number']
              }) }} 
              style={{ maxHeight: '500px', overflow: 'auto' }}
            />
          ) : (
            <Empty 
              description={t('requestDetails.noDiffAvailable')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
            />
          )}
        </Card>
      ),
    },
    {
      key: 'modified_code',
      label: <><CodeOutlined /> {t('requestDetails.modifiedCode')}</>,
      children: (
        <Card 
          size="small" 
          style={{ marginTop: 8 }}
          extra={
            parsedContent?.modified_code && (
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyToClipboard(parsedContent.modified_code!, 'modified code')}
              >
                {t('requestDetails.copyCode')}
              </Button>
            )
          }
        >
          {parsedContent?.modified_code ? (
            <SyntaxHighlighter
              language="typescript"
              style={effectiveTheme === 'dark' ? vscDarkPlus : vs}
              customStyle={{
                margin: 0,
                maxHeight: '500px',
                borderRadius: '6px',
                background: 'var(--card-bg-color)',
              }}
            >
              {parsedContent.modified_code}
            </SyntaxHighlighter>
          ) : (
            <Empty 
              description={t('requestDetails.noModifiedCode')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
            />
          )}
        </Card>
      ),
    },
  ];

  if (parsedContent?.modification_analysis && parsedContent.modification_analysis.length > 0) {
    analysisTabItems.push({
      key: 'modification_analysis',
      label: <><FileTextOutlined /> {t('requestDetails.modificationAnalysis')}</>,
      children: (
        <Card size="small" style={{ marginTop: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {parsedContent.modification_analysis.map((item, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8 }}>
                {renderMarkdownContent(
                  typeof item === 'string' ? item : JSON.stringify(item, null, 2)
                )}
              </Card>
            ))}
          </Space>
        </Card>
      ),
    });
  }

  return (
    <>
      <RequestStatus
        status={requestData.status}
        isSuccess={requestData.is_success}
        errorMessage={requestData.error_message}
        parsingError={parsingError}
      />

      <Tabs
        activeKey={activeAnalysisTabKey}
        onChange={setActiveAnalysisTabKey}
        tabPosition="top"
        size="small"
        items={analysisTabItems}
      />
    </>
  );
};

export default AnalysisResultsTabs;