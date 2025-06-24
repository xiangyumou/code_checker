import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { 
  SendOutlined, 
  DeleteOutlined, 
  PictureOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { message, Image } from 'antd';
import { cn } from '@/shared/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SubmissionFormProps {
  onSubmit: (data: { text: string; images: string[] }) => Promise<void>;
  loading?: boolean;
}

export const SubmissionForm: React.FC<SubmissionFormProps> = ({ onSubmit, loading }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        message.error(t('user.errors.invalidFileType'));
        return false;
      }
      if (file.size > 2 * 1024 * 1024) {
        message.error(t('user.errors.fileTooLarge'));
        return false;
      }
      return true;
    });

    const newImages = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    if (images.length + newImages.length > 5) {
      message.error(t('user.errors.tooManyImages'));
      return;
    }

    setImages(prev => [...prev, ...newImages]);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      handleFiles(files);
    }
  }, [images.length]);

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) {
      message.warning(t('user.errors.emptySubmission'));
      return;
    }

    const imageDataUrls = await Promise.all(
      images.map(img => 
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img.file);
        })
      )
    );

    await onSubmit({ text, images: imageDataUrls });
    
    setText('');
    setImages([]);
    images.forEach(img => URL.revokeObjectURL(img.preview));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-0">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('user.submit.title')}
            </h2>
            <div className="text-sm text-gray-500">
              <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">⌘</kbd>
              <span className="mx-1">+</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd>
              <span className="ml-2">{t('user.submit.submitShortcut')}</span>
            </div>
          </div>

          <div
            className={cn(
              "relative rounded-lg border-2 border-dashed transition-colors",
              dragActive 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                : "border-gray-300 dark:border-gray-700"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={t('user.submit.placeholder')}
              className="border-0 focus:ring-0 min-h-[200px] resize-none"
              disabled={loading}
            />
            
            {images.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                <div className="text-center">
                  <PictureOutlined className="text-4xl text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    {t('user.submit.dragDropHint')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
              >
                {images.map((img, index) => (
                  <motion.div
                    key={img.preview}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative group"
                  >
                    <Image
                      src={img.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CloseOutlined className="text-xs" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              loading={loading}
              disabled={loading || (!text.trim() && images.length === 0)}
              icon={<SendOutlined />}
              className="flex-1 sm:flex-initial"
            >
              {t('user.submit.submit')}
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || images.length >= 5}
              icon={<PictureOutlined />}
            >
              {t('user.submit.addImage')}
            </Button>
            
            {(text || images.length > 0) && (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setText('');
                  setImages([]);
                  images.forEach(img => URL.revokeObjectURL(img.preview));
                }}
                disabled={loading}
                icon={<DeleteOutlined />}
              >
                {t('common.clear')}
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};