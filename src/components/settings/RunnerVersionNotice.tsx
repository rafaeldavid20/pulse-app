'use client';

import { useState } from 'react';
import type { RunnerSummary } from '@/lib/firestore';
import { runnerReportIsCurrent, runnerVersionLabel, runnerUpdateCommands } from '@/lib/runner-version';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const date = (value?: string) => value ? new Date(value).toLocaleString('es-AR') : 'sin fecha';

export function RunnerVersionNotice({ runner, activeJob = false }: { runner: RunnerSummary; activeJob?: boolean }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState(true);
  const [copyState, setCopyState] = useState('Copiar comandos');
  const current = runnerReportIsCurrent(runner);
  const commands = runnerUpdateCommands(service);
  return <div className="space-y-2 text-xs text-secondary">
    <p>{current ? 'Versión efectiva del proceso' : 'Última versión reportada (sin conexión vigente)'}: <strong>{runner.processVersion ?? 'desconocida'}</strong> · {date(runner.versionReportedAt)}</p>
    <p>{runnerVersionLabel(runner)}{!current && runner.updateStatus !== 'unknown' ? ' · comparación del último reporte' : ''}
      {runner.release?.version && <> · Publicada estable: {runner.release.version} · <a className="text-accent hover:underline" href={`https://www.npmjs.com/package/@pulsehub/runner/v/${encodeURIComponent(runner.release.version)}`} target="_blank" rel="noopener noreferrer">Ver versión publicada</a></>}
      {runner.changesUrl && <> · <a className="text-accent hover:underline" href={runner.changesUrl} target="_blank" rel="noopener noreferrer">Ver cambios</a></>}
    </p>
    {runner.release?.checkedAt && <p className="text-tertiary">Última comprobación de npm: {date(runner.release.checkedAt)}{runner.release.status === 'unavailable' ? '. Reintentaremos automáticamente; también podés actualizar la vista.' : ''}</p>}
    <button type="button" className="text-accent hover:underline" onClick={() => setOpen(true)}>Ver cómo actualizar</button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={`Actualizar ${runner.displayName}`} maxWidth="lg">
      <div className="space-y-4 text-sm text-secondary">
        <p>Ejecutá estos pasos en la máquina y con el usuario del Runner. Conservá su directorio PULSE_RUNNER_HOME, pairing y claves; no hace falta volver a vincularlo.</p>
        {(activeJob || runner.status === 'busy') && <p role="alert" className="text-priority-high">Hay un job activo. Esperá a que termine antes de detener el Runner.</p>}
        <p>Reemplazá <code>&lt;DIRECTORIO_ACTUAL_DEL_RUNNER&gt;</code> por el mismo directorio que usa esta instancia. Si usás el directorio predeterminado, podés quitar <code>--home</code> y su valor de todos los comandos. Repetí el procedimiento por cada instancia independiente.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={service} onChange={event => { setService(event.target.checked); setCopyState('Copiar comandos'); }} />Instalado como servicio de usuario</label>
        {!service && <p>Detené primero el proceso en su terminal con Ctrl+C y esperá a que salga. El último comando vuelve a iniciarlo en primer plano.</p>}
        <p>Para la instalación npm de @pulsehub/runner (Node.js 20 o superior), sin sudo. Si usás un checkout de desarrollo, actualizalo con su procedimiento local y reiniciá ese proceso.</p>
        <pre className="overflow-x-auto rounded-lg border border-default bg-elevated p-3 text-xs text-primary">{commands}</pre>
        <Button variant="secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(commands); setCopyState('Comandos copiados'); }
          catch { setCopyState('No se pudo copiar; seleccioná los comandos'); }
        }}>{copyState}</Button>
        <p>Instalar el paquete no cambia un proceso que sigue vivo. El próximo heartbeat tras reiniciar confirmará la versión. Los contadores históricos que nunca se enviaron no se recuperan al actualizar.</p>
        <p>La actualización es recomendada. Los requisitos obligatorios de protocolo y capacidades se verifican por separado en la preparación del agente.</p>
      </div>
    </Modal>
  </div>;
}
