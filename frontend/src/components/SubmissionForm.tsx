import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
// Removed Select, Spin imports related to Monaco Editor
// Removed CodeOutlined icon
// Added Typography for Title
import { Form, Input, Button, Upload, message, Space, Spin, Row, Col, Typography } from 'antd';
import { UploadOutlined, ClearOutlined, SendOutlined, InboxOutlined } from '@ant-design/icons';
import type { RcFile, UploadFile, UploadProps } from 'antd/es/upload/interface';
// Removed Monaco Editor imports

import { createAnalysisRequest } from '../api/requests';
import { SubmissionFormData } from '../types';

const { TextArea } = Input;
const { Dragger } = Upload;
const { Title } = Typography; // Import Title
// Function to convert file to Base64 (remains the same)
const getBase64 = (file: RcFile): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

interface SubmissionFormProps {
  onSubmissionSuccess?: () => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ onSubmissionSuccess }) => {
  const { t } = useTranslation(); // Initialize useTranslation hook
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  // Removed code state
  // Removed editorLanguage state
  const [imageBase64List, setImageBase64List] = useState<string[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const draggerRef = useRef<HTMLDivElement>(null);

  // --- Image Validation Logic (remains the same) ---
  const validateImage = (file: File): boolean => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!isJpgOrPng) {
        message.error(t('submissionForm.validation.imageFormatError')); // Define new key
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error(t('submissionForm.validation.imageSizeError')); // Define new key
      }
      return isJpgOrPng && isLt2M;
  };

  // --- Image Handling (Unified for Upload and Paste) (remains the same) ---
  const processImageFile = (file: RcFile): boolean => {
      if (!validateImage(file)) {
          return false;
      }
      return true;
  };

  // --- Upload onChange Handler (remains the same logic, handles base64 generation) ---
  const handleUploadChange: UploadProps['onChange'] = ({ file, fileList: newFileList }) => {
    setFileList(newFileList);
    const validFiles = newFileList.filter(f => f.status !== 'error' && f.originFileObj);

    const base64Promises = validFiles
      .filter(f => f.originFileObj && !imageBase64List.some(b64 => b64.startsWith(`data:${f.type};base64,`)))
      .map(async (f) => {
        if (f.originFileObj) {
          try {
            const base64 = await getBase64(f.originFileObj as RcFile);
            return { uid: f.uid, base64 };
          } catch (error) {
            message.error(t('submissionForm.imageProcessingError', { name: f.name })); // Define new key
            console.error("Base64 generation error:", error);
            setFileList(prev => prev.map(pf => pf.uid === f.uid ? { ...pf, status: 'error' } : pf));
            return { uid: f.uid, base64: null };
          }
        }
        return { uid: f.uid, base64: null };
      });

    Promise.all(base64Promises).then(results => {
      const newBase64Map = new Map<string, string>();
      results.forEach(r => {
        if (r.base64) {
          newBase64Map.set(r.uid, r.base64);
        }
      });
      const updatedBase64List = validFiles
        .map(f => newBase64Map.get(f.uid))
        .filter((b64): b64 is string => b64 !== null && b64 !== undefined);
      setImageBase64List(updatedBase64List);
    });
  };

  // --- Upload Props (remains largely the same) ---
  const uploadProps: UploadProps = {
    name: 'problemImages',
    multiple: true,
    listType: "picture-card",
    fileList: fileList,
    maxCount: 5,
    beforeUpload: (file) => {
      const isValid = processImageFile(file);
      if (!isValid) {
          return Upload.LIST_IGNORE;
      }
      // Return false to prevent default upload, rely on onChange for processing
      // Correction: Return true to allow onChange to process, but not auto-upload
      return true;
    },
    onChange: handleUploadChange,
    // customRequest: ({ onSuccess }) => { // Prevent default upload behavior
    //     setTimeout(() => {
    //       onSuccess?.("ok");
    //     }, 0);
    // },
    // onRemove handled by onChange implicitly
  };


  // --- Paste Handling for Dragger (remains the same) ---
  const handlePasteInDragger = useCallback(async (event: ClipboardEvent) => {
    const maxCount = uploadProps.maxCount ?? 5;
    if (fileList.length >= maxCount) {
        message.warning(t('submissionForm.validation.maxImagesWarning', { count: maxCount })); // Define new key
        event.preventDefault();
        return;
    }
    const items = event.clipboardData?.items;
    if (!items) return;
    let imageFound = false;
    for (let i = 0; i < items.length && !imageFound; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          imageFound = true;
          event.preventDefault();
          const pastedFile = new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type }) as RcFile;
          pastedFile.uid = `-paste-${Date.now()}`;
          if (!processImageFile(pastedFile)) {
              return;
          }
          message.info(t('submissionForm.pasteDetected')); // Define new key
          const newUploadFile: UploadFile = {
              uid: pastedFile.uid,
              name: pastedFile.name,
              status: 'done',
              originFileObj: pastedFile,
              size: pastedFile.size,
              type: pastedFile.type,
          };
          handleUploadChange({
              file: newUploadFile,
              fileList: [...fileList, newUploadFile]
          });
        }
      }
    }
  }, [fileList, uploadProps.maxCount, processImageFile, handleUploadChange, t]); // Add t dependency

  // --- Paste Handling for the Unified TextArea ---
  // This function now handles pasting images *into* the TextArea area,
  // redirecting them to the Upload component.
  const handlePasteInTextArea = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (fileList.length >= (uploadProps.maxCount ?? 5)) {
        // Allow text paste even if image limit is reached
    } else {
        const items = event.clipboardData?.items;
        if (!items) return;
        let imageFound = false;
        for (let i = 0; i < items.length && !imageFound; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    imageFound = true;
                    // Prevent pasting image data as text into the TextArea
                    event.preventDefault();
                    const pastedFile = new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type }) as RcFile;
                    pastedFile.uid = `-paste-textarea-${Date.now()}`; // Different UID prefix for clarity
                    if (!processImageFile(pastedFile)) {
                        return;
                    }
                    message.info(t('submissionForm.pasteDetectedTextArea')); // Define new key
                    const newUploadFile: UploadFile = {
                        uid: pastedFile.uid,
                        name: pastedFile.name,
                        status: 'done',
                        originFileObj: pastedFile,
                        size: pastedFile.size,
                        type: pastedFile.type,
                    };
                    // Simulate onChange to add the file to the Dragger list
                    handleUploadChange({
                        file: newUploadFile,
                        fileList: [...fileList, newUploadFile]
                    });
                    return; // Stop after handling the first image
                }
            }
        }
    }
    // If no image is found or limit is reached, allow default paste behavior (e.g., pasting text)
  }, [fileList, uploadProps.maxCount, processImageFile, handleUploadChange, t]); // Add t dependency


  // Effect to add/remove paste listener to the dragger area (remains the same)
  useEffect(() => {
    const draggerElement = draggerRef.current;
    if (draggerElement) {
      draggerElement.addEventListener('paste', handlePasteInDragger);
    }
    return () => {
      if (draggerElement) {
        draggerElement.removeEventListener('paste', handlePasteInDragger);
      }
    };
  }, [handlePasteInDragger]);


  // --- Form Actions ---
  // Updated onFinish function
  const onFinish = async (values: { unifiedInput?: string }) => { // Updated values type
    const unifiedInput = values.unifiedInput?.trim() || ''; // Get text from the new TextArea

    // Get valid files from the current fileList state
    const validFiles = fileList.filter(f => f.status !== 'error' && f.originFileObj);

    // --- Validation: Ensure at least text or image is provided ---
    // Use validFiles.length for validation instead of potentially stale imageBase64List
    if (!unifiedInput && validFiles.length === 0) {
      message.error(t('submissionForm.validation.emptySubmissionError')); // Define new key
      return; // Stop submission if both are empty
    }
    // --- End Validation ---

    setIsLoading(true);

    try {
      // --- REMOVED Base64 generation logic ---

      // Extract File objects from the valid UploadFile items and filter out undefined/non-File
      const imageFiles: File[] = validFiles
        .map(f => f.originFileObj) // Get the original File object (which is RcFile | undefined)
        .filter((file): file is RcFile => file instanceof File) // Filter out undefined and ensure it's at least a File (RcFile extends File)
        .map(rcFile => rcFile as File); // Cast RcFile back to File, as RcFile is assignable to File

      // Construct the payload with user_prompt and the actual File objects
      const payload: SubmissionFormData = {
        user_prompt: unifiedInput, // Pass the unifiedInput directly (can be "")
        images: imageFiles.length > 0 ? imageFiles : null, // Pass the correctly typed File array
      };

      // Log the final payload (optional, for debugging)
      // console.log('DEBUG: Final payload being sent:', payload);

      // Call createAnalysisRequest with the payload containing File objects
      const newRequest = await createAnalysisRequest(payload);
      message.success(t('submissionForm.successMessageWithId', { id: newRequest.id })); // Define new key
      handleClear();
      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (error: any) {
      const backendError = error?.response?.data?.detail;
      message.error(backendError || t('submissionForm.errorMessage')); // Use existing key for default
      console.error("Submission error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Updated handleClear function
  const handleClear = () => {
    form.resetFields(); // This should clear the 'unifiedInput' field
    setImageBase64List([]);
    setFileList([]);
    message.info(t('submissionForm.formCleared')); // Define new key
  };

  // --- Ctrl+Enter Submission (remains the same for the form) ---
  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      // Check if the event target is the TextArea to potentially allow Shift+Enter for newlines
      // However, the default behavior here is to submit, which is usually desired.
      // If Shift+Enter is needed for newlines within the TextArea, this logic might need adjustment
      // or rely on the default behavior of TextArea. For now, Ctrl+Enter submits.
       if (!(event.target instanceof HTMLTextAreaElement && event.shiftKey)) {
            event.preventDefault();
            form.submit();
       }
    }
  };

  // Removed handleEditorDidMount function

  // --- Return Updated JSX ---
  return (
    // Add Spin overlay for loading state
    <Spin spinning={isLoading} tip={t('submissionForm.submitting')} size="large">
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        disabled={isLoading}
        requiredMark={false}
        onKeyDown={handleKeyDown} // Attach keydown listener to the form
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }} // Ensure form takes height
      >
        {/* Form Title */}
        <Title level={4} style={{ marginBottom: '24px', textAlign: 'center' }}>{t('submissionForm.title')}</Title>

        {/* Unified Text Input Area */}
        <Form.Item
          label={t('submissionForm.unifiedInputLabel')} // Define new key
          name="unifiedInput"
          tooltip={t('submissionForm.unifiedInputTooltip')} // Define new key
          style={{ flexShrink: 0 }} // Prevent shrinking
        >
          <TextArea
            rows={10} // Slightly reduced rows
            placeholder={t('submissionForm.unifiedInputPlaceholder')} // Define new key
            onPaste={handlePasteInTextArea}
          />
        </Form.Item>

        {/* Image Upload Area */}
        <Form.Item
          label={t('submissionForm.addImageLabel')} // Define new key
          tooltip={t('submissionForm.addImageTooltip')} // Define new key
          style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', marginBottom: '24px' }} // Allow to grow and add margin. Flex properties applied here control the children.
          // Removed invalid bodyStyle prop
        >
          {/* Wrap Dragger in a div to attach ref and control height */}
          {/* The flexGrow style here allows this div (and the Dragger inside) to expand */}
          <div ref={draggerRef} style={{ flexGrow: 1 }}>
              <Dragger {...uploadProps} style={{ height: '100%' }}> {/* Make Dragger fill height */}
                  <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">{t('submissionForm.uploadText')}</p> {/* Define new key */}
                  <p className="ant-upload-hint">{t('submissionForm.uploadHint')}</p> {/* Define new key */}
              </Dragger>
          </div>
        </Form.Item>

        {/* Action Buttons */}
        <Form.Item style={{ marginTop: 'auto', flexShrink: 0 }}> {/* Push buttons to bottom */}
          <Space>
            <Button
              type="primary" // Will inherit green color from ConfigProvider
              htmlType="submit"
              icon={<SendOutlined />}
              loading={isLoading}
              size="large"
            >
              {t('submissionForm.submitButton')} {/* Define new key */}
            </Button>
            <Button
              htmlType="button"
              onClick={handleClear}
              icon={<ClearOutlined />}
              disabled={isLoading}
              size="large"
            >
              {t('submissionForm.clearButton')} {/* Define new key */}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Spin>
  );
};

export default SubmissionForm;