import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Import necessary Ant Design components and icons
// Added Typography, Row, Col
import { Drawer, Tabs, Descriptions, Card, Empty, Tag, Alert, Image as AntdImage, Space, Spin, message, Typography, Row, Col } from 'antd';
import { DiffOutlined, CodeOutlined, FileTextOutlined, ExperimentOutlined, InfoCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
// Import libraries for diffing, highlighting, and markdown
import { createPatch } from 'diff';
import * as Diff2Html from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css'; // Or choose another theme
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';

// Import local components and types
import StatusIndicator from './StatusIndicator'; // Assuming StatusIndicator is in the same directory
import { AnalysisRequest, OrganizedProblem, ModificationAnalysisItem } from '../types'; // Adjust path if needed

// TabPane is deprecated, will use items prop instead.
const { Title, Paragraph, Text } = Typography; // Use Typography components

// Define the expected structure within the gpt_raw_response JSON string
interface GptResponseContent {
  organized_problem?: OrganizedProblem | null;
  modified_code?: string | null;
  modification_analysis?: ModificationAnalysisItem[] | null;
  original_code?: string | null;
}

// Define props for the Drawer
interface RequestDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  requestData: AnalysisRequest | null;
  // Add props for handling deletion notification from parent (MainLayout -> RequestManagementPage -> Drawer)
  deletedRequestId: number | null;
  resetDeletedRequestId: () => void;
}

// Helper function to highlight code blocks
const highlightCode = (elementId: string) => {
    setTimeout(() => {
        const block = document.getElementById(elementId);
        if (block) {
            try {
                hljs.highlightElement(block as HTMLElement);
            } catch (error) {
                console.error("Highlighting error:", error, "on element:", elementId);
            }
        }
    }, 0);
};

// --- Helper functions copied from frontend ---
// Helper to render markdown sections with a title
const renderMarkdownSection = (title: string, content: string | null | undefined) => (
    content ? (
        <div style={{ marginBottom: '16px' }}>
            <Title level={5} style={{ marginBottom: '8px' }}>{title}</Title>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeMermaid]}>
                {content}
            </ReactMarkdown>
        </div>
    ) : null // Don't render section if content is empty
);

// Helper to render code block sections with a title
const renderCodeBlockSection = (title: string, content: string | null | undefined) => (
    content ? (
        <div style={{ marginBottom: '16px' }}>
            <Title level={5} style={{ marginBottom: '8px' }}>{title}</Title>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f9f9f9', border: '1px solid #eee', padding: '10px', borderRadius: '4px', marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                <code>{content}</code>
            </pre>
        </div>
    ) : null // Don't render section if content is empty
);
// --- End of copied helper functions ---


const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({
  open, // Type is defined in RequestDetailDrawerProps
  onClose, // Type is defined in RequestDetailDrawerProps
  requestData, // Type is defined in RequestDetailDrawerProps
  deletedRequestId, // Type is defined in RequestDetailDrawerProps
  resetDeletedRequestId, // Type is defined in RequestDetailDrawerProps
}: RequestDetailDrawerProps) => { // Explicitly type the destructured props
  const { t } = useTranslation(); // Initialize useTranslation hook
  const navigate = useNavigate(); // Keep navigate if needed for future actions
  const [parsedContent, setParsedContent] = useState<GptResponseContent | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [activeAnalysisTabKey, setActiveAnalysisTabKey] = useState('problem'); // State for inner tabs
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // --- JSON Parsing Logic ---
  useEffect(() => {
    // Reset state when requestData changes or drawer opens/closes
    setParsedContent(null);
    setParsingError(null);
    setActiveAnalysisTabKey('problem');

    if (open && requestData) {
        if (requestData.status === 'Completed' && requestData.is_success && requestData.gpt_raw_response) {
            try {
                let parsed: unknown;
                // Check if gpt_raw_response is already an object or a string needing parsing
                if (typeof requestData.gpt_raw_response === 'string') {
                    parsed = JSON.parse(requestData.gpt_raw_response);
                } else if (typeof requestData.gpt_raw_response === 'object' && requestData.gpt_raw_response !== null) {
                    // It's already an object, use it directly
                    parsed = requestData.gpt_raw_response;
                } else {
                    throw new Error("Response is neither a valid JSON string nor a direct object.");
                }

                // Validate the parsed content structure (basic check)
                if (typeof parsed === 'object' && parsed !== null) {
                    setParsedContent(parsed as GptResponseContent);
                    setParsingError(null);
                } else {
                    // This case might be redundant now but kept for safety
                    throw new Error("Parsed content is not a valid object.");
                }
            } catch (error) {
                console.error("Admin Drawer: Failed to process GPT response:", error);
                // Provide a more specific error message if possible
                const errorMessage = error instanceof SyntaxError
                    ? `Invalid JSON format: ${error.message}`
                    : error instanceof Error
                        ? error.message
                        : "Failed to process response.";
                setParsingError(errorMessage);
                setParsedContent(null);
            }
        } else if (requestData.status === 'Completed' && requestData.is_success && !requestData.gpt_raw_response) {
            setParsingError(t('requestDetails.responseMissing')); // Use translation
            setParsedContent(null);
        } else {
            // Reset for non-completed/failed states or when drawer closes
            setParsedContent(null);
            setParsingError(null);
        }
    } else {
        // Reset when drawer is closed or no data
        setParsedContent(null);
        setParsingError(null);
    }
  }, [requestData, open]); // Rerun when requestData or open status changes

  // --- Effect to handle deletion while viewing details ---
  useEffect(() => {
    if (open && deletedRequestId !== null && requestData?.id === deletedRequestId) {
      console.log(`[RequestDetailDrawer] Detected deletion of currently viewed request ID: ${deletedRequestId}`);
      // Use t() for message
      message.warning(t('requestDetails.deletedWarning', { id: deletedRequestId }), 5); // Define new key
      onClose(); // Close the drawer
      resetDeletedRequestId(); // Reset the state in the parent
    }
  }, [open, deletedRequestId, requestData, onClose, resetDeletedRequestId]); // Add open dependency

  // Generate Diff HTML
  const diffHtml = useMemo(() => {
    // Keep ignoreWhitespace: true for admin view consistency for now, or match frontend's false if needed
    if (!open || !requestData || requestData.status !== 'Completed' || !requestData.is_success || parsingError || !parsedContent || !parsedContent.modified_code) {
      return null;
    }
    setIsDiffLoading(true);
    try {
        const normalizeNewlines = (str: string) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const originalCodeSource = parsedContent?.original_code || requestData?.user_prompt || '';
        const originalCodeNormalized = normalizeNewlines(originalCodeSource);
        const modifiedCodeNormalized = normalizeNewlines(parsedContent.modified_code || '');

        const patchFileName = `Request_${requestData.id}.code`;
        const diffString = createPatch(
            patchFileName, originalCodeNormalized, modifiedCodeNormalized,
            '', '', { context: 5, ignoreWhitespace: true } // Keep ignoreWhitespace for now
        );
        const generatedHtml = Diff2Html.html(diffString, {
            drawFileList: false, matching: 'lines', outputFormat: 'side-by-side', renderNothingWhenEmpty: true,
        });
        setIsDiffLoading(false);
        return generatedHtml;
    } catch (error) {
        console.error("Error generating diff:", error);
        setIsDiffLoading(false);
        // Use t() for error message
        return `<p style="color: red;">${t('requestDetails.diffError', { error })}</p>`; // Define new key
    }
  }, [requestData, parsedContent, parsingError, open, t]); // Add t dependency

  // Highlight code snippets
  useEffect(() => {
    if (!open || !requestData) return; // Only run if drawer is open and has data

    const reqId = requestData.id;

    if (requestData.status !== 'Completed' || !requestData.is_success || parsingError) {
        setIsAnalysisLoading(false);
        return;
    }

    // Highlight modification analysis snippets
    if (activeAnalysisTabKey === 'analysis_details' && parsedContent?.modification_analysis) {
      setIsAnalysisLoading(true);
      parsedContent.modification_analysis.forEach((_: ModificationAnalysisItem, index: number) => { // Add types
        highlightCode(`admin-drawer-original-snippet-${reqId}-${index}`); // Use unique prefix
        highlightCode(`admin-drawer-modified-snippet-${reqId}-${index}`); // Use unique prefix
      });
      const timer = setTimeout(() => setIsAnalysisLoading(false), 100);
      return () => clearTimeout(timer);
    } else if (activeAnalysisTabKey !== 'analysis_details') {
        setIsAnalysisLoading(false);
    }

    // Highlight source code tab
    if (activeAnalysisTabKey === 'source_code' && parsedContent?.original_code) {
        highlightCode(`admin-drawer-source-code-block-${reqId}`); // Use unique prefix
    }

    // Highlight raw response tab
    if (activeAnalysisTabKey === 'raw' && requestData?.gpt_raw_response) {
        highlightCode(`admin-drawer-raw-response-${reqId}`); // Use unique prefix
    }
  }, [parsedContent, requestData, activeAnalysisTabKey, parsingError, open]); // Add open dependency

  // --- Rendering Functions (Adapted from AdminRequestDetailView) ---

  // --- Refactored renderProblemTab ---
  const renderProblemTab = () => {
    // Use t() for Empty description
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Define new key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    // Show specific error in admin view
    // Use t() for default error message
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={requestData.error_message || "分析失败"} />;

    // Handle Completed state
    if (parsingError) return <StatusIndicator status="failed" message={`加载问题详情时出错: ${parsingError}`} />; // Localized
    if (!requestData.is_success) return <StatusIndicator status="failed" message={requestData.error_message || "分析失败"} />;

    const problem = parsedContent?.organized_problem;
    if (!parsedContent) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>正在解析响应...</span>} /></div>; // Localized - Fixed Spin tip
    if (!problem) return <Empty description="响应中未找到结构化的问题详情。" />; // Localized

    return (
        <div style={{ padding: '0 8px' }}> {/* Add slight padding like frontend */}
            <Title level={4} style={{ marginBottom: '16px' }}>{problem.title || '未知问题标题'}</Title>
            <Row gutter={24} style={{ marginBottom: '16px' }}>
                <Col><Text>时间限制: <Text strong>{problem.time_limit || 'N/A'}</Text></Text></Col>
                <Col><Text>内存限制: <Text strong>{problem.memory_limit || 'N/A'}</Text></Text></Col>
            </Row>
            {renderMarkdownSection('问题描述', problem.description)}
            {renderMarkdownSection('输入格式', problem.input_format)}
            {renderMarkdownSection('输出格式', problem.output_format)}
            <Row gutter={16}>
                <Col xs={24} md={12}>{renderCodeBlockSection('输入样例', problem.input_sample)}</Col>
                <Col xs={24} md={12}>{renderCodeBlockSection('输出样例', problem.output_sample)}</Col>
            </Row>
            {renderMarkdownSection('提示', problem.notes)}
        </div>
    );
  };
  // --- End of Refactored renderProblemTab ---

  // --- Refactored renderModificationAnalysis ---
  const renderModificationAnalysis = () => {
    // Use t() for Empty description and error messages
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use same key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.analysisLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    const analysis = parsedContent?.modification_analysis;
    const reqId = requestData?.id ?? 'unknown';
    // Use t() for Spin tips and Empty description
    if (!parsedContent) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>{t('requestDetails.parsingResponse')}</span>} /></div>; // Use same key - Fixed Spin tip
    if (isAnalysisLoading) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>{t('requestDetails.loadingAnalysis')}</span>} /></div>; // Define new key - Fixed Spin tip
    if (!analysis || analysis.length === 0) {
      return <Empty description={t('requestDetails.noAnalysisDetails')} />; // Define new key
    }

    const codeLanguage = 'cpp'; // TODO: Determine language dynamically

    return analysis.map((item: ModificationAnalysisItem, index: number) => ( // Add types
      <Card
        key={index}
        // Use t() for Card title with interpolation
        title={t('requestDetails.modificationPoint', { index: index + 1 })} // Define new key
        size="small"
        style={{ marginBottom: 16 }}
        headStyle={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }} // Lighter head background from frontend
        bodyStyle={{ paddingTop: 8 }} // Reduce top padding in body from frontend
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Original Snippet */}
            {item.original_snippet && (
                <div>
                    {/* Use t() for label */}
                    <Text strong>{t('requestDetails.originalSnippet')}:</Text> {/* Define new key */}
                    <pre style={{ marginTop: '4px', background: '#fff0f0', border: '1px solid #ffccc7', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        <code id={`admin-drawer-original-snippet-${reqId}-${index}`} className={`language-${codeLanguage}`}>
                            {item.original_snippet}
                        </code>
                    </pre>
                </div>
            )}
            {/* Modified Snippet */}
            {item.modified_snippet && (
                <div>
                    {/* Use t() for label */}
                    <Text strong>{t('requestDetails.modifiedSnippet')}:</Text> {/* Define new key */}
                    <pre style={{ marginTop: '4px', background: '#f6ffed', border: '1px solid #b7eb8f', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        <code id={`admin-drawer-modified-snippet-${reqId}-${index}`} className={`language-${codeLanguage}`}>
                            {item.modified_snippet}
                        </code>
                    </pre>
                </div>
            )}
            {/* Explanation */}
            {item.explanation && (
                <div>
                    {/* Use t() for label */}
                    <Text strong>{t('requestDetails.explanation')}:</Text> {/* Define new key */}
                    <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: `3px solid #eee` }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeMermaid]}>
                            {item.explanation}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </Space>
      </Card>
    ));
  };
  // --- End of Refactored renderModificationAnalysis ---

  const renderSourceCodeTab = () => {
    // Use t() for Empty description, error messages, Spin tip
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use same key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.sourceCodeLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    if (!parsedContent) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>{t('requestDetails.parsingResponse')}</span>} /></div>; // Use same key - Fixed Spin tip

    const originalCode = parsedContent?.original_code;
    const reqId = requestData?.id ?? 'unknown';
    const editorLanguage = 'cpp'; // TODO: Determine language dynamically

    if (originalCode === null || originalCode === undefined || originalCode === '') {
        return <Empty description={t('requestDetails.noOriginalCode')} />; // Define new key
    }

    // TODO: Add copy button here as well? (Consider adding later if needed)
    return (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '10px', borderRadius: '4px', maxHeight: '70vh', overflowY: 'auto' }}>
            <code id={`admin-drawer-source-code-block-${reqId}`} className={`language-${editorLanguage}`}>
                {originalCode}
            </code>
        </pre>
    );
  };

  const renderDiffTab = () => {
    // Use t() for Empty description, error messages, Spin tips
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use same key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.diffLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={requestData.error_message || t('requestDetails.analysisFailed')} />; // Use same key

    if (!parsedContent) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>{t('requestDetails.parsingResponse')}</span>} /></div>; // Use same key - Fixed Spin tip
    if (isDiffLoading) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={<span>{t('requestDetails.generatingDiff')}</span>} /></div>; // Define new key - Fixed Spin tip

    if (!diffHtml) {
        if (parsedContent && !parsedContent.modified_code) {
            return <Empty description={t('requestDetails.noModifiedCode')} />; // Define new key
        }
        if (parsedContent && !parsedContent.original_code && !requestData?.user_prompt) {
            return <Empty description={t('requestDetails.diffMissingSource')} />; // Define new key
        }
        return <Empty description={t('requestDetails.diffGeneralError')} />; // Define new key
    }

    // Apply frontend's diff container style for consistency
    return <div className="diff-container" style={{ background: '#fff', border: '1px solid #eee', borderRadius: '6px', overflowX: 'auto', padding: '5px' }} dangerouslySetInnerHTML={{ __html: diffHtml }} />;
  };

  const renderRawResponse = () => {
      // Use t() for Empty description
      if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use same key
      if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
      if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
      // Raw response might be available even if failed

      const rawResponse = requestData.gpt_raw_response;
      const reqId = requestData?.id ?? 'unknown';

      if (!rawResponse) {
          return <Empty description={t('requestDetails.noRawResponse')} />; // Define new key
      }

      return (
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '10px', maxHeight: '70vh', overflowY: 'auto' }}>
              <code id={`admin-drawer-raw-response-${reqId}`} className="language-json">
                  {typeof rawResponse === 'object' && rawResponse !== null
                      ? JSON.stringify(rawResponse, null, 2)
                      : rawResponse}
              </code>
          </pre>
      );
  };

  // --- Main Drawer Content ---
  const renderContent = () => {
    if (!requestData) {
        // Should ideally not happen if drawer is opened only with data, but handle defensively
        // Use t() for Spin tip
        return <Spin tip={<span>{t('requestDetails.loadingRequestData')}</span>} />; // Define new key - Fixed Spin tip
    }

    return (
      <div>
          {/* Basic Request Info - Adjust columns for wider view */}
          {/* Use t() for Description labels */}
          <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t('requestManagement.id')}>{requestData.id}</Descriptions.Item>
              <Descriptions.Item label={t('requestManagement.status')}>
                   <Tag color={
                       requestData.status === 'Completed' ? (requestData.is_success ? 'success' : 'error') :
                       requestData.status === 'Processing' ? 'processing' :
                       requestData.status === 'Failed' ? 'error' : 'default'
                   }>
                       {requestData.status}
                   </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('requestManagement.createdAt')}>{new Date(requestData.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('requestManagement.updatedAt')}>{new Date(requestData.updated_at).toLocaleString()}</Descriptions.Item>
               {requestData.status === 'Failed' && requestData.error_message && (
                  <Descriptions.Item label={t('requestManagement.error')} span={2}>{requestData.error_message}</Descriptions.Item>
              )}
          </Descriptions>

          {/* Tabs for Details - Changed type to 'line' */}
          {/* Use t() for TabPane titles */}
          <Tabs
              defaultActiveKey="original_submission"
              type="line"
              style={{ marginTop: '24px' }}
              items={[
                  {
                      key: 'original_submission',
                      label: <><DatabaseOutlined /> {t('requestDetails.originalSubmission')}</>,
                      children: (
                          <Descriptions bordered column={1} size="small">
                              <Descriptions.Item label={t('requestDetails.userPrompt')}>
                                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{requestData.user_prompt || t('requestDetails.noUserPrompt')}</pre>
                              </Descriptions.Item>
                              {/* Display multiple images using images_base64 */}
                              {requestData.images_base64 && requestData.images_base64.length > 0 && (
                                  // Using a more generic key, assuming translation handles plurality or context.
                                  // Providing default English text as fallback and reminder for translation.
                                  <Descriptions.Item label={t('requestDetails.submittedImages', 'Submitted Images')}>
                                      <AntdImage.PreviewGroup>
                                          <Space wrap size={[8, 8]}> {/* Use Space for layout */}
                                              {requestData.images_base64.map((base64String, index) => (
                                                  <AntdImage
                                                      key={index}
                                                      width={150} // Adjusted width for multiple images
                                                      src={`data:image/png;base64,${base64String}`}
                                                      // Providing default English text as fallback and reminder for translation.
                                                      alt={t('requestDetails.submittedImageAltMultiple', `Submitted Image ${index + 1}`, { index: index + 1 })}
                                                      style={{ border: '1px solid #eee', objectFit: 'contain', padding: '2px', background: '#fff', maxHeight: '150px' }} // Adjusted maxHeight
                                                  />
                                              ))}
                                          </Space>
                                      </AntdImage.PreviewGroup>
                                  </Descriptions.Item>
                              )}
                              {/* Handle case where there are no images explicitly */}
                              {(!requestData.images_base64 || requestData.images_base64.length === 0) && (
                                   <Descriptions.Item label={t('requestDetails.submittedImages', 'Submitted Images')}>
                                       {/* Providing default English text as fallback and reminder for translation. */}
                                       {t('requestDetails.noImagesSubmitted', 'No images submitted.')}
                                   </Descriptions.Item>
                              )}
                          </Descriptions>
                      ),
                  },
                  {
                      key: 'analysis_results',
                      label: <><ExperimentOutlined /> {t('requestDetails.analysisResults')}</>,
                      children: (
                          <>
                              {/* Display overall success/failure only when Completed */}
                              {requestData.status === 'Completed' && (
                                  <div style={{ marginBottom: 16, marginTop: 0 }}>
                                      <Tag icon={<InfoCircleOutlined />} color={requestData.is_success ? 'success' : 'error'}>
                                          {requestData.is_success ? t('requestDetails.analysisSuccess') : t('requestDetails.analysisFailed')}
                                      </Tag>
                                      {/* Show Parsing Error only if Completed, Successful, but parsing failed */}
                                      {requestData.is_success && parsingError && (
                                          <Tag color="warning">{t('requestDetails.parsingError', { error: parsingError })}</Tag>
                                      )}
                                  </div>
                              )}

                              {/* Inner Tabs using items prop */}
                              <Tabs
                                  activeKey={activeAnalysisTabKey}
                                  onChange={setActiveAnalysisTabKey}
                                  tabPosition="top"
                                  size="small"
                                  items={[
                                      {
                                          key: 'problem',
                                          label: <><FileTextOutlined /> {t('requestDetails.problemDetails')}</>,
                                          children: renderProblemTab(),
                                      },
                                      {
                                          key: 'source_code',
                                          label: <><CodeOutlined /> {t('requestDetails.sourceCode')}</>,
                                          children: renderSourceCodeTab(),
                                      },
                                      {
                                          key: 'diff',
                                          label: <><DiffOutlined /> {t('requestDetails.codeDiff')}</>,
                                          children: renderDiffTab(),
                                      },
                                      {
                                          key: 'analysis_details',
                                          label: <><ExperimentOutlined /> {t('requestDetails.analysisDetails')}</>,
                                          children: renderModificationAnalysis(),
                                      },
                                      {
                                          key: 'raw',
                                          label: <><CodeOutlined /> {t('requestDetails.rawResponse')}</>,
                                          children: renderRawResponse(),
                                      },
                                  ]}
                              />
                          </>
                      ),
                  },
              ]}
          />
      </div>
    );
  }


  return (
    <Drawer
      // Use t() for title with interpolation
      title={requestData ? t('requestDetails.drawerTitleWithId', { id: requestData.id }) : t('requestDetails.drawerTitle')} // Define new keys
      placement="right"
      onClose={onClose}
      open={open}
      width="75%" // Use a wider drawer as planned
      destroyOnClose // Reset state when closed
      styles={{ body: { paddingBottom: 80, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' } }} // Add padding, overflow, maxHeight like frontend
      // Optional Footer for actions (Keep commented out for now)
      // footer={
      //   <Space style={{ textAlign: 'right' }}>
      //     <Button onClick={onClose}>关闭</Button>
      //     {/* Add other actions like Retry/Delete here if needed */}
      //   </Space>
      // }
    >
      {renderContent()}
    </Drawer>
  );
};

export default RequestDetailDrawer;