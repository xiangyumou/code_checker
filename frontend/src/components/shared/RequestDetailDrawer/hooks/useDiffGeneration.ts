import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPatch } from 'diff';
import * as Diff2Html from 'diff2html';
import type { AnalysisRequest } from '../../../../types/index';

interface GptResponseContent {
  organized_problem?: any;
  modified_code?: string | null;
  modification_analysis?: any;
  original_code?: string | null;
}

export const useDiffGeneration = (
  requestData: AnalysisRequest | null,
  parsedContent: GptResponseContent | null,
  parsingError: string | null
) => {
  const { t } = useTranslation();
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  const diffHtml = useMemo(() => {
    if (!requestData || requestData.status !== 'Completed' || !requestData.is_success || parsingError || !parsedContent || !parsedContent.modified_code) {
      return null;
    }

    setIsDiffLoading(true);
    try {
      const patchFileName = `请求_${requestData.id}.代码`;
      const diffString = createPatch(
        patchFileName,
        parsedContent?.original_code || requestData?.user_prompt || '',
        parsedContent.modified_code || '',
        '', 
        '', 
        { context: 5 }
      );
      
      const generatedHtml = Diff2Html.html(diffString, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        renderNothingWhenEmpty: true,
      });
      
      setIsDiffLoading(false);
      return generatedHtml;
    } catch (error) {
      setIsDiffLoading(false);
      return `<p style="color: red;">${t('requestDetails.diffError', { error: error instanceof Error ? error.message : String(error) })}</p>`;
    }
  }, [requestData, parsedContent, parsingError, t]);

  return {
    diffHtml,
    isDiffLoading,
  };
};