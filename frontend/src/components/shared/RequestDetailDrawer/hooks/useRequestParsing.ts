import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnalysisRequest, OrganizedProblem, ModificationAnalysisItem } from '../../../../types/index';

interface GptResponseContent {
  organized_problem?: OrganizedProblem | null;
  modified_code?: string | null;
  modification_analysis?: ModificationAnalysisItem[] | null;
  original_code?: string | null;
}

export const useRequestParsing = (
  open: boolean,
  requestData: AnalysisRequest | null
) => {
  const { t } = useTranslation();
  const [parsedContent, setParsedContent] = useState<GptResponseContent | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);

  useEffect(() => {
    setParsedContent(null);
    setParsingError(null);

    if (open && requestData?.status === 'Completed' && requestData.is_success) {
      if (requestData.gpt_raw_response) {
        try {
          let parsed: unknown;
          
          if (typeof requestData.gpt_raw_response === 'string') {
            parsed = JSON.parse(requestData.gpt_raw_response);
          } else if (typeof requestData.gpt_raw_response === 'object' && requestData.gpt_raw_response !== null) {
            parsed = requestData.gpt_raw_response;
          } else {
            throw new Error(t('requestDetails.parsingErrorInvalidType'));
          }

          if (typeof parsed === 'object' && parsed !== null) {
            setParsedContent(parsed as GptResponseContent);
            setParsingError(null);
          } else {
            throw new Error(t('requestDetails.parsingErrorInvalidObject'));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : t('requestDetails.parsingErrorUnknown');
          setParsingError(t('requestDetails.parsingErrorGeneral', { error: errorMessage }));
          setParsedContent(null);
        }
      } else {
        setParsingError(t('requestDetails.parsingErrorEmptyResponse'));
        setParsedContent(null);
      }
    } else if (open && requestData?.status === 'Completed' && !requestData.is_success) {
      setParsedContent(null);
      setParsingError(requestData.error_message || t('requestDetails.analysisCompletedButFailed'));
    } else {
      setParsedContent(null);
      setParsingError(null);
    }
  }, [open, requestData, t]);

  return {
    parsedContent,
    parsingError,
  };
};