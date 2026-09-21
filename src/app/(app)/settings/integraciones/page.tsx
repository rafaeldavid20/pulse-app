'use client';

import React from 'react';
import { GitHubSection } from '@/components/settings/GitHubSection';
import { ApiKeysSection } from '@/components/settings/ApiKeysSection';

export default function IntegrationsSettingsPage() {
  return (
    <>
      <GitHubSection />
      <ApiKeysSection />
    </>
  );
}
