import { Label } from '@/types';

/**
 * Índice de etiquetas por id y por nombre. Hasta que corra la migración de
 * TES-265 hay `labelIds` con ids (`lbl-…`) y con nombres conviviendo, así que
 * el render necesita poder resolver ambos.
 */
export interface LabelIndex {
  byId: Record<string, Label>;
  byName: Record<string, Label>;
}

export function buildLabelIndex(labels: Label[]): LabelIndex {
  return {
    byId: Object.fromEntries(labels.map((l) => [l.id, l])),
    byName: Object.fromEntries(labels.map((l) => [l.name, l])),
  };
}

/** Busca primero por id y, si no encuentra, por nombre — nunca al revés. */
export function resolveLabel(index: LabelIndex, idOrName: string): Label | undefined {
  return index.byId[idOrName] ?? index.byName[idOrName];
}
