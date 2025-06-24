import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Added Typography, Divider, Alert, Skeleton, Tooltip, Row, Col
// Import Image as AntdImage to avoid naming conflict
// Changed Modal to Drawer
import { Drawer, Tabs, Descriptions, Card, Empty, Button, Space, Tag, Select, message, Typography, Divider, Alert, Skeleton, Spin, Tooltip, Row, Col, Image as AntdImage } from 'antd';
// Added InfoCircleOutlined for error display, CopyOutlined for copy button
// Added CodeOutlined for Source Code tab icon, DatabaseOutlined for Original Submission
// Added icons for status matching RequestList
import { DiffOutlined, CodeOutlined, FileTextOutlined, ExperimentOutlined, ReloadOutlined, InfoCircleOutlined, CopyOutlined, DatabaseOutlined, SyncOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { createPatch } from 'diff';
import * as Diff2Html from 'diff2html';
import StatusIndicator from './StatusIndicator'; // Import the new component
import 'diff2html/bundles/css/diff2html.min.css'; // Keep CSS for now
import hljs from 'highlight.js';
// Changed theme to github (light) - ensure this CSS is correctly loaded/bundled
import 'highlight.js/styles/github.css';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import remarkGfm from 'remark-gfm'; // Add GFM plugin for tables, etc.
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';

import { AnalysisRequest, OrganizedProblem, ModificationAnalysisItem, RequestStatus } from '../../types/index'; // Import existing types, Added RequestStatus
import { regenerateAnalysis } from '../../api/shared';

// Define the expected structure within the gpt_raw_response JSON string
interface GptResponseContent {
  organized_problem?: OrganizedProblem | null;
  modified_code?: string | null;
  modification_analysis?: ModificationAnalysisItem[] | null;
  original_code?: string | null; // Add original_code back, assuming GPT might return it
}


// const { TabPane } = Tabs; // Removed deprecated TabPane import
// const { Option } = Select; // Option is no longer needed
const { Title, Paragraph, Text } = Typography; // Use Typography components
// Changed interface name and isOpen to open
interface RequestDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  requestData: AnalysisRequest | null; // Parent ensures this is loaded before opening
  isLoading: boolean; // Add isLoading prop to indicate when parent is fetching data
  onRegenerateSuccess?: (updatedRequest: AnalysisRequest) => void;
  apiClient: any; // API client instance for making requests
}

// Helper function to highlight code blocks (remains the same)
const highlightCode = (elementId: string) => {
    // Use setTimeout to allow DOM update before highlighting
    setTimeout(() => {
        try {
            const block = document.getElementById(elementId);
            if (block) {
                hljs.highlightElement(block as HTMLElement);
            }
        } catch (error) {
            // Silently handle highlighting errors
        }
    }, 0);
};

// Helper to get status display properties (similar to RequestList)
// Now uses the 't' function from the component's scope directly
const getStatusProps = (status: RequestStatus | undefined, isSuccess: boolean | undefined, t: ReturnType<typeof useTranslation>['t']): { color: string; icon: React.ReactNode; text: string } => {
    switch (status) {
      case 'Completed':
        return isSuccess
          ? { color: 'success', icon: <CheckCircleOutlined />, text: t('requestList.completed') }
          : { color: 'error', icon: <CloseCircleOutlined />, text: t('requestDetails.analysisFailed') };
      case 'Processing':
        return { color: 'processing', icon: <SyncOutlined spin />, text: t('requestList.processing') };
      case 'Failed':
        return { color: 'error', icon: <CloseCircleOutlined />, text: t('requestDetails.analysisFailed') };
      case 'Queued':
        return { color: 'default', icon: <ClockCircleOutlined />, text: t('requestList.pending') };
      default:
        return { color: 'default', icon: <QuestionCircleOutlined />, text: t('requestDetails.unknownStatus') };
    }
};


// Changed component name and isOpen to open
const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({
  open,
  onClose,
  requestData,
  isLoading, // Destructure isLoading prop
  onRegenerateSuccess,
  apiClient
}) => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const [activeTopTabKey, setActiveTopTabKey] = useState('original_submission'); // Default back to original submission tab
  const [activeAnalysisTabKey, setActiveAnalysisTabKey] = useState('problem'); // State for nested analysis tabs
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false); // Loading state for diff generation
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false); // Loading state for analysis rendering/highlighting
  const [parsedContent, setParsedContent] = useState<GptResponseContent | null>(null); // State for parsed JSON content
  const [parsingError, setParsingError] = useState<string | null>(null); // State for parsing errors

  // --- JSON Parsing Logic ---
  useEffect(() => {
    // Reset state when drawer opens or request data changes significantly
    setParsedContent(null);
    setParsingError(null);

    // Only attempt parsing if the request is Completed and successful
    // Changed isOpen to open
    if (open && requestData?.status === 'Completed' && requestData.is_success) {
        if (requestData.gpt_raw_response) {
            try {
                let parsed: unknown;
                // Check if it's a string before parsing
                if (typeof requestData.gpt_raw_response === 'string') {
                    parsed = JSON.parse(requestData.gpt_raw_response);
                } else if (typeof requestData.gpt_raw_response === 'object' && requestData.gpt_raw_response !== null) {
                    // If it's already an object, use it directly
                    parsed = requestData.gpt_raw_response;
                } else {
                    // Handle cases where it's neither a string nor a valid object (e.g., null, undefined, other types)
                    throw new Error(t('requestDetails.parsingErrorInvalidType')); // Define new key for invalid type
                }

                // Basic validation: ensure it's an object after potential parsing
                if (typeof parsed === 'object' && parsed !== null) {
                    setParsedContent(parsed as GptResponseContent);
                    setParsingError(null);
                    // Successfully parsed/used GPT response
                } else {
                    // This case might be redundant if the initial check is thorough, but kept for safety
                    throw new Error(t('requestDetails.parsingErrorInvalidObject')); // Use existing key
                }
            } catch (error) {
                // Failed to parse/process GPT response
                const errorMessage = error instanceof Error ? error.message : t('requestDetails.parsingErrorUnknown'); // Use existing key
                setParsingError(t('requestDetails.parsingErrorGeneral', { error: errorMessage })); // Use existing key
                setParsedContent(null);
            }
        } else {
            // Successful analysis but no raw response content
            setParsingError(t('requestDetails.parsingErrorEmptyResponse')); // Define new key
            setParsedContent(null);
        }
    // Changed isOpen to open
    } else if (open && requestData?.status === 'Completed' && !requestData.is_success) {
        // Completed but not successful (e.g., GPT failed internally but backend marked as Completed)
        setParsedContent(null);
        setParsingError(requestData.error_message || t('requestDetails.analysisCompletedButFailed')); // Define new key
    } else {
        // For Queued, Processing, or Failed states, clear parsed content and parsing error
        setParsedContent(null);
        setParsingError(null);
    }
  // Changed isOpen to open
  }, [open, requestData]); // Rerun when drawer opens or requestData changes

  // No need for selectedVersion memoization anymore, use requestData directly

  // Effect to reset tab when drawer opens/request changes
  useEffect(() => {
    // Changed isOpen to open
    if (open) {
      // Reset tabs to default when drawer opens
      setActiveTopTabKey('original_submission'); // Default back to original submission
      setActiveAnalysisTabKey('problem');
    }
  // Changed isOpen to open
  }, [open]); // Depend only on open

  // --- Diff Generation ---
  const diffHtml = useMemo(() => {
    // Only generate diff if completed, successful, parsed, and has modified code
    if (!requestData || requestData.status !== 'Completed' || !requestData.is_success || parsingError || !parsedContent || !parsedContent.modified_code) {
      return null;
    }
    setIsDiffLoading(true); // Set loading true before generation
    try {
      const patchFileName = `请求_${requestData.id}.代码`;
      const diffString = createPatch(
        patchFileName,
        // Prioritize parsed original_code, fallback to user_prompt only if original_code is absent/empty
        parsedContent?.original_code || requestData?.user_prompt || '',
        parsedContent.modified_code || '', // If modified_code is null/empty, diff will show deletion
        '', '', { context: 5 } // Removed ignoreWhitespace for potentially meaningful whitespace changes
      );
      const generatedHtml = Diff2Html.html(diffString, {
         drawFileList: false,
         matching: 'lines',
         outputFormat: 'side-by-side',
         renderNothingWhenEmpty: true,
      });
      setIsDiffLoading(false); // Set loading false after generation
      return generatedHtml;
    } catch (error) {
        // Diff generation error
        setIsDiffLoading(false);
        return `<p style="color: red;">${t('requestDetails.diffError', { error: error instanceof Error ? error.message : String(error) })}</p>`; // Use existing key
    }
  }, [requestData, parsedContent, parsingError, t]); // Re-run when these change, add t dependency

  // --- Code Highlighting Effects ---
  useEffect(() => {
    const reqId = requestData?.id ?? 'unknown';
    // Only highlight if completed, successful, and parsed
    if (requestData?.status !== 'Completed' || !requestData.is_success || parsingError) {
        setIsAnalysisLoading(false);
        return;
    }

    // Highlight modification analysis snippets if tab is active
    // Changed isOpen to open
    if (open && activeAnalysisTabKey === 'analysis_details' && parsedContent?.modification_analysis) {
      setIsAnalysisLoading(true);
      const analysisItems = parsedContent.modification_analysis;
      if (analysisItems && analysisItems.length > 0) {
        analysisItems.forEach((_, index) => {
          // Ensure unique IDs if copying from admin drawer later
          highlightCode(`original-snippet-${reqId}-${index}`);
          highlightCode(`modified-snippet-${reqId}-${index}`);
        });
        const timer = setTimeout(() => setIsAnalysisLoading(false), 100);
        return () => clearTimeout(timer);
      } else {
        setIsAnalysisLoading(false);
      }
    } else if (activeAnalysisTabKey !== 'analysis_details') {
        setIsAnalysisLoading(false);
    }

    // Highlight source code tab if active
    // Changed isOpen to open
    if (open && activeTopTabKey === 'analysis_results' && activeAnalysisTabKey === 'source_code' && parsedContent?.original_code) {
       highlightCode(`source-code-block-${reqId}`);
    }
  // Changed isOpen to open
  }, [parsedContent, open, activeTopTabKey, activeAnalysisTabKey, requestData, parsingError]); // Added top tab key dependency


  // --- Regeneration Handler ---
  const handleRegenerate = async () => {
      if (!requestData) return;
      setIsRegenerating(true);
      try {
          const updatedRequest = await regenerateAnalysis(apiClient, requestData.id);
          message.success(t('requestDetails.regenerateSuccess', { id: requestData.id })); // Define new key
          if (onRegenerateSuccess) {
              onRegenerateSuccess(updatedRequest);
          }
          onClose(); // Close drawer after triggering
      } catch (error: any) {
          const backendError = error?.response?.data?.detail;
          message.error(backendError || t('requestDetails.regenerateError')); // Define new key
          // Regeneration error handled
      } finally {
          setIsRegenerating(false);
      }
  };

  // --- Render Functions for Tabs ---

  // Problem Details Tab
  const renderProblemTab = () => {
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Define new key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Handle Completed state
    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.problemLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Check if content is parsed and available
    const problem = parsedContent?.organized_problem;
    if (!parsedContent && !parsingError) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.parsingResponse')} /></div>; // Define new key
    if (!problem) return <Empty description={parsingError ? t('requestDetails.problemLoadErrorEmpty', { error: parsingError }) : t('requestDetails.noProblemDetails')} />; // Define new keys

    // Helper to render markdown sections with a title
    const renderMarkdownSection = (titleKey: string, content: string | null | undefined) => (
        content ? (
            <div style={{ marginBottom: '16px' }}>
                <Title level={5} style={{ marginBottom: '8px' }}>{t(titleKey)}</Title> {/* Use t() for title */}
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeMermaid]}>
                    {content}
                </ReactMarkdown>
            </div>
        ) : null // Don't render section if content is empty
    );

    // Helper to render code block sections with a title
    const renderCodeBlockSection = (titleKey: string, content: string | null | undefined) => (
        content ? (
            <div style={{ marginBottom: '16px' }}>
                <Title level={5} style={{ marginBottom: '8px' }}>{t(titleKey)}</Title> {/* Use t() for title */}
                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--button-bg-color)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '4px', marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                    <code>{content}</code>
                </pre>
            </div>
        ) : null // Don't render section if content is empty
    );

    return (
        <div style={{ padding: '0 8px' }}> {/* Add slight padding */}
            <Title level={4} style={{ marginBottom: '16px' }}>{problem.title || t('requestDetails.unknownProblemTitle')}</Title> {/* Define new key */}
            <Row gutter={24} style={{ marginBottom: '16px' }}>
                <Col><Text>{t('requestDetails.timeLimit')}: <Text strong>{problem.time_limit || 'N/A'}</Text></Text></Col> {/* Define new key */}
                <Col><Text>{t('requestDetails.memoryLimit')}: <Text strong>{problem.memory_limit || 'N/A'}</Text></Text></Col> {/* Define new key */}
            </Row>
            {renderMarkdownSection('requestDetails.problemDescription', problem.description)} {/* Define new key */}
            {renderMarkdownSection('requestDetails.inputFormat', problem.input_format)} {/* Define new key */}
            {renderMarkdownSection('requestDetails.outputFormat', problem.output_format)} {/* Define new key */}
            <Row gutter={16}>
                <Col xs={24} md={12}>{renderCodeBlockSection('requestDetails.inputSample', problem.input_sample)}</Col> {/* Define new key */}
                <Col xs={24} md={12}>{renderCodeBlockSection('requestDetails.outputSample', problem.output_sample)}</Col> {/* Define new key */}
            </Row>
            {renderMarkdownSection('requestDetails.notes', problem.notes)} {/* Define new key */}
        </div>
    );
  };

  // Code Diff Tab
  const renderDiffTab = () => {
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use existing key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Handle Completed state
    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.diffLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Check if content is parsed
    if (!parsedContent && !parsingError) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.parsingResponse')} /></div>; // Use existing key
    if (parsingError) return <Empty description={t('requestDetails.diffLoadErrorEmpty', { error: parsingError })} />; // Define new key

    if (isDiffLoading) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.generatingDiff')} /></div>; // Define new key

    // Check conditions for showing Empty state more precisely
    const originalAvailable = !!(parsedContent?.original_code || requestData?.user_prompt);
    const modifiedAvailable = !!parsedContent?.modified_code;

    if (!originalAvailable && !modifiedAvailable) {
         return <Empty description={t('requestDetails.diffMissingBoth')} />; // Define new key
    }
    if (!modifiedAvailable) {
         return <Empty description={t('requestDetails.noModifiedCode')} />; // Define new key
    }
    // If original is missing but modified exists, diff might still be generated (showing full addition)
    if (!originalAvailable) {
         // Consider showing a message or the diff anyway
         // Original code/prompt missing, diff might show full addition.
         // return <Empty description={t('requestDetails.diffMissingSource')} />; // Define new key
    }

    if (!diffHtml) {
        // This case might mean no actual changes were detected by createPatch
        return <Empty description={t('requestDetails.diffGeneralError')} />; // Define new key
    }

    // Apply styles directly, avoid relying solely on external CSS if possible
    // Sanitize HTML to prevent XSS attacks
    const sanitizedDiffHtml = DOMPurify.sanitize(diffHtml, {
      ALLOWED_TAGS: ['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'thead', 'pre', 'code', 'ins', 'del', 'strong', 'em', 'b', 'i'],
      ALLOWED_ATTR: ['class', 'style', 'data-line-number']
    });
    return <div className="diff-container" style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', padding: '5px' }} dangerouslySetInnerHTML={{ __html: sanitizedDiffHtml }} />;
  };

  // Modification Analysis Tab
  const renderModificationAnalysis = () => {
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use existing key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Handle Completed state
    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.analysisLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

     // Check if content is parsed
    const analysis = parsedContent?.modification_analysis;
    if (!parsedContent && !parsingError) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.parsingResponse')} /></div>; // Use existing key
    if (parsingError) return <Empty description={t('requestDetails.analysisLoadErrorEmpty', { error: parsingError })} />; // Define new key

    if (isAnalysisLoading) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.loadingAnalysis')} /></div>; // Define new key

    if (!analysis || analysis.length === 0) {
      return <Empty description={t('requestDetails.noAnalysisDetails')} />; // Define new key
    }

    // Determine language for highlighting (simple heuristic or default)
    // TODO: Ideally, language should be part of the request or response
    const codeLanguage = 'cpp'; // Default or detect based on snippets if possible

    return analysis.map((item, index) => (
      <Card
        key={index}
        title={t('requestDetails.modificationPoint', { index: index + 1 })} // Define new key
        size="small"
        style={{ marginBottom: 16 }}
        headStyle={{ background: 'var(--button-bg-color)', borderBottom: '1px solid var(--border-color)' }} // Lighter head background
        bodyStyle={{ paddingTop: 8 }} // Reduce top padding in body
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Original Snippet */}
            {item.original_snippet && (
                <div>
                    <Text strong>{t('requestDetails.originalSnippet')}:</Text> {/* Define new key */}
                    <pre style={{ marginTop: '4px', background: 'var(--code-bg-error)', border: '1px solid var(--border-color-error)', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        <code id={`original-snippet-${requestData?.id}-${index}`} className={`language-${codeLanguage}`}>
                            {item.original_snippet}
                        </code>
                    </pre>
                </div>
            )}
            {/* Modified Snippet */}
            {item.modified_snippet && (
                <div>
                    <Text strong>{t('requestDetails.modifiedSnippet')}:</Text> {/* Define new key */}
                    <pre style={{ marginTop: '4px', background: 'var(--code-bg-success)', border: '1px solid var(--border-color-success)', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        <code id={`modified-snippet-${requestData?.id}-${index}`} className={`language-${codeLanguage}`}>
                            {item.modified_snippet}
                        </code>
                    </pre>
                </div>
            )}
            {/* Explanation */}
            {item.explanation && (
                <div>
                    <Text strong>{t('requestDetails.explanation')}:</Text> {/* Define new key */}
                    <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: `3px solid var(--border-color)` }}>
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

  // --- Source Code Tab ---
  const renderSourceCodeTab = () => {
    if (!requestData) return <Empty description={t('requestDetails.noData')} />; // Use existing key
    if (requestData.status === 'Queued') return <StatusIndicator status="queued" />;
    if (requestData.status === 'Processing') return <StatusIndicator status="processing" />;
    if (requestData.status === 'Failed') return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    // Handle Completed state
    if (parsingError) return <StatusIndicator status="failed" message={t('requestDetails.sourceCodeLoadError', { error: parsingError })} />; // Define new key
    if (!requestData.is_success) return <StatusIndicator status="failed" message={t('requestDetails.analysisFailed')} />; // Use existing key

    if (!parsedContent && !parsingError) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.parsingResponse')} /></div>; // Use existing key

    const originalCode = parsedContent?.original_code;
    // if (!parsedContent && !parsingError) return <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip={t('requestDetails.parsingResponse')} /></div>; // Redundant check
    if (parsingError) return <Empty description={t('requestDetails.sourceCodeLoadErrorEmpty', { error: parsingError })} />; // Define new key

    if (originalCode === null || originalCode === undefined || originalCode === '') {
        return <Empty description={t('requestDetails.noOriginalCode')} />; // Define new key
    }

    const reqId = requestData?.id ?? 'unknown';
    const codeLanguage = 'cpp'; // Default or detect

    const handleCopy = async () => {
        if (!originalCode) {
            message.error(t('requestDetails.copyCodeErrorNoCode')); // Define new key
            return;
        }
        try {
            await navigator.clipboard.writeText(originalCode);
            message.success(t('requestDetails.copyCodeSuccess')); // Define new key
        } catch (err) {
            // Copy failed
            message.error(t('requestDetails.copyCodeErrorFailed')); // Define new key
        }
    };

    return (
        <div style={{ position: 'relative' }}>
             <Tooltip title={t('requestDetails.copyCodeTooltip')}> {/* Define new key */}
                <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopy}
                    size="small"
                    style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 1 }}
                />
            </Tooltip>
            <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--button-bg-color)', border: '1px solid var(--border-color)', padding: '10px', paddingTop: '30px', borderRadius: '4px', maxHeight: '60vh', overflowY: 'auto' }}>
                <code id={`source-code-block-${reqId}`} className={`language-${codeLanguage}`}>
                    {originalCode}
                </code>
            </pre>
        </div>
    );
  };

  // Removed editorLanguage placeholder and version check logic

  // Get status props based on current request data
  const statusProps = getStatusProps(requestData?.status, requestData?.is_success, t); // Call with t from useTranslation hook

  // Changed Modal to Drawer, updated props
  return (
    <Drawer
      title={requestData ? t('requestDetails.drawerTitleWithId', { id: requestData.id }) : t('requestDetails.drawerTitle')} // Define new keys
      placement="right" // Added placement
      width="75%" // Added width
      onClose={onClose}
      open={open} // Changed isOpen to open
      destroyOnClose // Added destroyOnClose
      // Removed footer, style, styles
      // Add a footer section for buttons if needed, similar to Modal's footer
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
             <Button
                  onClick={handleRegenerate}
                  icon={<ReloadOutlined />}
                  loading={isRegenerating}
                  // Disable only if regenerating or request is processing
                  disabled={isRegenerating || requestData?.status === 'Processing'}
              >
                  {isRegenerating ? t('requestDetails.regeneratingButton') : t('requestDetails.regenerateButton')} {/* Define new keys */}
              </Button>
              <Button onClick={onClose}>{t('common.close')}</Button> {/* Define new key */}
          </Space>
        </div>
      }
      // Drawer body style for scrolling
      styles={{ body: { overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', padding: '16px 24px', position: 'relative' } }} // Add relative positioning for Spin overlay
    >
      {/* Show loading overlay if isLoading is true */}
      {isLoading && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(128, 128, 128, 0.5)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" tip={t('requestDetails.loadingDetails')} /> {/* Define new key */}
        </div>
      )}

      {/* Render content only if not loading AND requestData exists */}
      {!isLoading && requestData ? (
        <>
          {/* Tabs Section */}
          <Tabs
            activeKey={activeTopTabKey}
            onChange={setActiveTopTabKey}
            type="line" // Use line type tabs
            items={[
              {
                key: 'original_submission',
                label: <><DatabaseOutlined /> {t('requestDetails.originalSubmission')}</>, // Define new key
                children: (
                  <Descriptions bordered column={1} size="small" layout="vertical">
                    <Descriptions.Item label={t('requestDetails.userPrompt')}> {/* Define new key */}
                      {requestData.user_prompt ? (
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--button-bg-color)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '4px', maxHeight: '40vh', overflowY: 'auto' }}>
                          <code>{requestData.user_prompt}</code>
                        </pre>
                      ) : (
                        <Text type="secondary">{t('requestDetails.noUserPrompt')}</Text> // Define new key
                      )}
                    </Descriptions.Item>
                    {/* Display Base64 images if available */}
                    {requestData.images_base64 && requestData.images_base64.length > 0 ? (
                      <Descriptions.Item label={t('requestDetails.submittedImages', { count: requestData.images_base64.length })}>
                        <AntdImage.PreviewGroup>
                          {/* Use Space for layout, wrap allows items to flow to the next line */}
                          <Space wrap size={[16, 16]} style={{ width: '100%' }}>
                            {requestData.images_base64.map((base64String, index) => (
                              <AntdImage
                                key={index}
                                width={180} // Consistent smaller width for multiple images
                                // Assuming PNG format. For other formats, backend needs to provide MIME type.
                                // Consider adding error handling or type detection if needed.
                                src={`data:image/png;base64,${base64String}`}
                                alt={t('requestDetails.submittedImageAlt', { index: index + 1 })}
                                style={{ border: '1px solid var(--border-color)', objectFit: 'contain', background: 'var(--button-bg-color)', borderRadius: '4px', display: 'inline-block' }} // Added display inline-block for Space layout
                              />
                            ))}
                          </Space>
                        </AntdImage.PreviewGroup>
                      </Descriptions.Item>
                    ) : (
                      // Message when no images are submitted
                      <Descriptions.Item label={t('requestDetails.submittedImages', { count: 0 })}>
                        <Text type="secondary">{t('requestDetails.noImageSubmitted')}</Text>
                      </Descriptions.Item>
                    )}
                    {/* Keep old logic commented out for reference */}
                    {/*
                    {Array.isArray(requestData.image_references) && requestData.image_references.length > 0 && (
                      <Descriptions.Item label={t('requestDetails.submittedImages', { count: requestData.image_references.length })}>
                        <AntdImage.PreviewGroup>
                          <Space wrap size={[16, 16]}>
                            {requestData.image_references.map((relativePath, index) => {
                              const backendBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
                              const imageUrl = `${backendBaseUrl}/static/${relativePath.startsWith('/') ? relativePath.substring(1) : relativePath}`;
                              return (
                                <AntdImage
                                  key={index}
                                  width={180}
                                  src={imageUrl}
                                  alt={t('requestDetails.submittedImageAlt', { index: index + 1 })}
                                  style={{ border: '1px solid var(--border-color)', objectFit: 'contain', background: 'var(--button-bg-color)', borderRadius: '4px' }}
                                  preview={{
                                    mask: <div style={{ background: 'rgba(0, 0, 0, 0.5)', color: 'white', textAlign: 'center', lineHeight: '180px' }}>{t('requestDetails.previewImage')}</div>,
                                  }}
                                  placeholder={
                                    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar-bg-color)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                      <Spin size="small" />
                                    </div>
                                  }
                                />
                              );
                            })}
                          </Space>
                        </AntdImage.PreviewGroup>
                      </Descriptions.Item>
                    )}
                    */}
                  </Descriptions>
                ),
              },
              {
                key: 'analysis_results',
                label: <><ExperimentOutlined /> {t('requestDetails.analysisResults')}</>, // Define new key
                children: (
                  <>
                    {/* Display overall status based on requestData */}
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Text strong>{t('requestList.status')}:</Text> {/* Use existing key */}
                      <Tag icon={statusProps.icon} color={statusProps.color} style={{ marginInlineEnd: 0 }}>
                        {statusProps.text}
                      </Tag>
                      {/* Show specific error message from request if Failed */}
                      {requestData.status === 'Failed' && requestData.error_message && (
                        <Tooltip title={requestData.error_message}>
                          <InfoCircleOutlined style={{ color: statusProps.color, cursor: 'help' }} />
                        </Tooltip>
                      )}
                      {/* Show parsing error if applicable */}
                      {parsingError && requestData.status === 'Completed' && (
                        <Tag color="warning" icon={<InfoCircleOutlined />}>{parsingError}</Tag> // Keep parsingError as is, it's already localized
                      )}
                    </div>

                    {/* Inner Tabs for different analysis views */}
                    <Tabs
                      activeKey={activeAnalysisTabKey}
                      onChange={setActiveAnalysisTabKey}
                      tabPosition="top"
                      size="small"
                      items={[
                        {
                          key: 'problem',
                          label: <><FileTextOutlined /> {t('requestDetails.problemDetails')}</>, // Define new key
                          children: renderProblemTab(),
                        },
                        {
                          key: 'source_code',
                          label: <><CodeOutlined /> {t('requestDetails.sourceCode')}</>, // Define new key
                          children: renderSourceCodeTab(),
                        },
                        {
                          key: 'diff',
                          label: <><DiffOutlined /> {t('requestDetails.codeDiff')}</>, // Define new key
                          children: renderDiffTab(),
                        },
                        {
                          key: 'analysis_details',
                          label: <><ExperimentOutlined /> {t('requestDetails.analysisDetails')}</>, // Define new key
                          children: renderModificationAnalysis(),
                        },
                      ]}
                    />
                  </>
                ),
              },
            ]}
          />
        </>
      ) : !isLoading && !requestData ? ( // Show empty state only if not loading and no data
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Empty description={t('requestDetails.noDataSelected')} /> {/* Use existing key */}
        </div>
      ) : null /* Don't render anything if isLoading is true (handled by overlay) */}
    </Drawer>
  );
};

// Changed export name
export default RequestDetailDrawer;