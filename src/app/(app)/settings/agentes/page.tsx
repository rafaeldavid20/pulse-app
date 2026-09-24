'use client';

import React from 'react';
import { AgentsSection } from '@/components/settings/AgentsSection';
import { AgentGuardrailsSection } from '@/components/settings/AgentGuardrailsSection';
import { RunnersSection } from '@/components/settings/RunnersSection';

export default function AgentsSettingsPage() {
  return (
    <>
      <AgentsSection />
      <RunnersSection />
      <AgentGuardrailsSection />
    </>
  );
}
