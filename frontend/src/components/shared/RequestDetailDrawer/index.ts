// Export the refactored component as the main export
export { default } from './RefactoredRequestDetailDrawer';

// Export individual components for potential reuse
export { default as OriginalSubmissionTab } from './components/OriginalSubmissionTab';
export { default as AnalysisResultsTabs } from './components/AnalysisResultsTabs';
export { default as RequestStatus } from './components/RequestStatus';

// Export hooks for potential reuse
export { useRequestParsing } from './hooks/useRequestParsing';
export { useDiffGeneration } from './hooks/useDiffGeneration';