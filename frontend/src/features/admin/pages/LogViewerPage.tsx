import React, { useState, useEffect, useCallback } from 'react';
import { Select, Button, Spin, InputNumber, Input, Space, Card, Typography, Alert } from 'antd';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { SyncOutlined } from '@ant-design/icons';
import { listLogFiles, getLogContent } from '../api/logs';

const { Option } = Select;
const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const LogViewerPage: React.FC = () => {
    const { t } = useTranslation(); // Initialize useTranslation hook
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
    const [logContent, setLogContent] = useState<string>('');
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingContent, setLoadingContent] = useState(false);
    const [tailLines, setTailLines] = useState<number | null>(200); // Default to last 200 lines

    // Fetch available log files on mount
    const fetchLogFiles = useCallback(async () => {
        setLoadingFiles(true);
        try {
            const files = await listLogFiles();
            setLogFiles(files);
            // Automatically select the first file if available
            if (files.length > 0 && !selectedFile) {
                setSelectedFile(files[0]);
            }
        } catch (error) {
            // Error handled by API message
        } finally {
            setLoadingFiles(false);
        }
    }, [selectedFile]); // Re-run if selectedFile changes (though it shouldn't affect the list)

    useEffect(() => {
        fetchLogFiles();
    }, [fetchLogFiles]);

    // Fetch log content when selected file or tailLines changes
    const fetchLogContent = useCallback(async () => {
        if (!selectedFile) {
            setLogContent('');
            return;
        }
        setLoadingContent(true);
        try {
            const content = await getLogContent(selectedFile, tailLines ?? undefined); // Pass null as undefined
            setLogContent(content);
        } catch (error) {
            // Use t() for error message
            setLogContent(t('logViewer.loadError', { error })); // Define new key
        } finally {
            setLoadingContent(false);
        }
    }, [selectedFile, tailLines]);

    useEffect(() => {
        fetchLogContent();
    }, [fetchLogContent]); // Run when the callback changes (due to dependencies)

    return (
        <Card> {/* Content is already wrapped in Card, ensure consistent styling */}
            <Title level={2} style={{ marginBottom: '24px' }}>{t('logViewer.title')}</Title> {/* Define new key */}
            {/* <Paragraph>{t('logViewer.description')}</Paragraph> */} {/* Optional: Define new key */}

            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}> {/* Use vertical space for controls */}
                <Space wrap> {/* Wrap controls for responsiveness */}
                    <Select
                        style={{ minWidth: 250 }} // Slightly wider select
                        placeholder={t('logViewer.selectPlaceholder')} // Define new key
                        loading={loadingFiles}
                        value={selectedFile}
                        onChange={(value) => setSelectedFile(value)}
                        disabled={loadingFiles || logFiles.length === 0}
                    >
                        {logFiles.map(file => (
                            <Option key={file} value={file}>{file}</Option>
                        ))}
                    </Select>
                    {/* Remove generic type constraint, allow component to handle null */}
                    <InputNumber
                        min={1}
                        value={tailLines}
                        onChange={(value: number | null) => setTailLines(value)} // Explicitly type the callback parameter
                        placeholder={t('logViewer.tailLinesPlaceholder')} // Define new key
                        addonBefore={t('logViewer.tailLinesAddon')} // Define new key
                        style={{ width: 200 }} // Wider input
                        disabled={!selectedFile || loadingContent}
                    />
                     <Button
                        onClick={fetchLogContent}
                        loading={loadingContent}
                        icon={<SyncOutlined />}
                        disabled={!selectedFile}
                    >
                        {t('logViewer.refreshButton')} {/* Define new key */}
                    </Button>
                </Space>
            </Space>

            {loadingContent ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin tip={t('logViewer.loadingContent')} /> {/* Define new key */}
                </div>
            ) : selectedFile ? (
                <TextArea
                    readOnly
                    value={logContent}
                    // Adjust height dynamically or use a larger fixed height
                    style={{ minHeight: '65vh', fontFamily: 'monospace', whiteSpace: 'pre', overflow: 'auto', fontSize: '12px' }}
                    placeholder={t('logViewer.contentPlaceholder', { file: selectedFile })} // Define new key
                />
            ) : (
                 <Alert message={t('logViewer.selectFileMessage')} type="info" showIcon /> // Define new key
            )}
        </Card>
    );
};

export default LogViewerPage;