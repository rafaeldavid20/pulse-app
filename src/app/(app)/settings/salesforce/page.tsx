'use client';

import React, { Suspense } from 'react';
import { Cloud } from 'lucide-react';
import { SalesforceSection } from '@/components/settings/SalesforceSection';
import { useProjectStore } from '@/stores/projectStore';
import { hasSalesforceProject } from '@/lib/projectKind';

export default function SalesforceSettingsPage() {
  // Sin proyectos Salesforce la pestaña no se muestra (TES-270), pero la URL
  // sigue existiendo: a quien llegue por un link se le explica cómo
  // habilitarla en vez de un 404. No es un control de acceso — ver
  // `hasSalesforceProject`.
  const enabled = useProjectStore((s) => hasSalesforceProject(s.projects));
  const loaded = useProjectStore((s) => s.loaded);

  // Hasta que llegan los proyectos no se sabe si el workspace es Salesforce:
  // mostrar "no tiene proyectos Salesforce" en ese instante sería falso.
  if (!loaded) return null;

  if (!enabled) {
    return (
      <div className="flex flex-col gap-2 p-5 bg-surface border border-default rounded-xl">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-secondary shrink-0" />
          <h3 className="text-base font-semibold text-primary">Salesforce</h3>
        </div>
        <p className="text-xs text-secondary">
          Este workspace no tiene proyectos Salesforce. Para conectar orgs, editá un proyecto y elegí
          el tipo <span className="font-semibold text-primary">Salesforce</span>.
        </p>
      </div>
    );
  }

  // `SalesforceSection` lee los search params del redirect de
  // `salesforceCallback` (`?sf=connected|error`), y eso obliga a un límite de
  // Suspense en una página exportada estáticamente.
  return (
    <Suspense fallback={null}>
      <SalesforceSection />
    </Suspense>
  );
}
