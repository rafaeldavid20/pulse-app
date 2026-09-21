'use client';

import React from 'react';
import { AgentsSection } from '@/components/settings/AgentsSection';
import { AgentGuardrailsSection } from '@/components/settings/AgentGuardrailsSection';

export default function AgentsSettingsPage() {
  return (
    <>
      <AgentsSection />
      <AgentGuardrailsSection />
    </>
  );
}
