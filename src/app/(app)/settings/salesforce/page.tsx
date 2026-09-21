import React, { Suspense } from 'react';
import { SalesforceSection } from '@/components/settings/SalesforceSection';

export default function SalesforceSettingsPage() {
  // `SalesforceSection` lee los search params del redirect de
  // `salesforceCallback` (`?sf=connected|error`), y eso obliga a un límite de
  // Suspense en una página exportada estáticamente.
  return (
    <Suspense fallback={null}>
      <SalesforceSection />
    </Suspense>
  );
}
