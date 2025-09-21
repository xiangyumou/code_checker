import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { RequestDetailModal } from '../../src/components/user/RequestDetailModal';
import type { AnalysisRequest, RequestSummary, RequestStatus } from '../../src/types';
import '../../src/i18n';

const PLACEHOLDER_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAgMBAp0a9L4AAAAASUVORK5CYII=';

const createSummary = (status: RequestStatus, overrides: Partial<RequestSummary> = {}): RequestSummary => ({
  id: overrides.id ?? 100,
  status,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
  error_message: overrides.error_message ?? null,
  filename: overrides.filename ?? null,
});

const createDetail = (
  summary: RequestSummary,
  overrides: Partial<AnalysisRequest> = {},
): AnalysisRequest => ({
  id: summary.id,
  status: summary.status,
  created_at: summary.created_at,
  updated_at: summary.updated_at,
  user_prompt: 'Explain the output of this snippet.',
  images_base64: [PLACEHOLDER_IMAGE],
  image_references: null,
  error_message: summary.error_message,
  gpt_raw_response: JSON.stringify(
    {
      organized_problem: {
        title: 'Sample Problem',
        description: 'Describe the behavior of the provided code.',
        input_format: 'N/A',
        output_format: 'N/A',
        input_sample: 'N/A',
        output_sample: 'N/A',
        notes: 'N/A',
        time_limit: '1s',
        memory_limit: '256MB',
      },
      original_code: 'console.log("Hello, world!");',
      modified_code: 'console.log("Hi, world!");',
      modification_analysis: [
        {
          explanation: 'Updates the greeting to a shorter phrase.',
          original_snippet: 'console.log("Hello, world!");',
          modified_snippet: 'console.log("Hi, world!");',
        },
      ],
    },
    null,
    2,
  ),
  is_success: summary.status === 'Completed',
  ...overrides,
});

const Template = (summary: RequestSummary, detail: AnalysisRequest) => (
  <RequestDetailModal
    request={summary}
    open
    onClose={() => undefined}
    onRegenerate={() => undefined}
    initialData={detail}
  />
);

const meta: Meta<typeof RequestDetailModal> = {
  title: 'User/RequestDetailModal',
  component: RequestDetailModal,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof RequestDetailModal>;

export const Queued: Story = {
  render: () => {
    const summary = createSummary('Queued');
    const detail = createDetail(summary, {
      gpt_raw_response: null,
      is_success: false,
    });
    return Template(summary, detail);
  },
};

export const Processing: Story = {
  render: () => {
    const summary = createSummary('Processing');
    const detail = createDetail(summary, {
      gpt_raw_response: null,
      is_success: false,
    });
    return Template(summary, detail);
  },
};

export const Completed: Story = {
  render: () => {
    const summary = createSummary('Completed');
    const detail = createDetail(summary, {
      is_success: true,
    });
    return Template(summary, detail);
  },
};

export const Failed: Story = {
  render: () => {
    const summary = createSummary('Failed', { error_message: 'Compilation error' });
    const detail = createDetail(summary, {
      gpt_raw_response: null,
      is_success: false,
      error_message: 'Compilation error',
    });
    return Template(summary, detail);
  },
};
