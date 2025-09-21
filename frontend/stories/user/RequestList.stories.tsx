import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { RequestList } from '../../src/components/user/RequestList';
import type { RequestSummary } from '../../src/types';

const baseRequests: RequestSummary[] = [
  {
    id: 1,
    status: 'Queued',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: null,
  },
  {
    id: 2,
    status: 'Processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: null,
  },
  {
    id: 3,
    status: 'Completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: null,
  },
  {
    id: 4,
    status: 'Failed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: 'Example failure message',
  },
];

const meta: Meta<typeof RequestList> = {
  title: 'User/RequestList',
  component: RequestList,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof RequestList>;

const render = (requests: RequestSummary[]): React.ReactElement => (
  <div className="w-[900px]">
    <RequestList
      requests={requests}
      loading={false}
      onRefresh={() => undefined}
      onRequestClick={() => undefined}
    />
  </div>
);

export const Queued: Story = {
  render: () => render([baseRequests[0]]),
};

export const Processing: Story = {
  render: () => render([baseRequests[1]]),
};

export const Completed: Story = {
  render: () => render([baseRequests[2]]),
};

export const Failed: Story = {
  render: () => render([baseRequests[3]]),
};
