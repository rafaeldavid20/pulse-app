/**
 * Paleta de colores seleccionables para labels y proyectos. Estos valores se
 * guardan como dato (label.color / project.color) y se aplican dinámicamente
 * vía inline style, por eso viven fuera del sistema de tokens de @theme.
 */
export const SWATCH_COLORS = [
  '#5E6AD2', // Indigo
  '#F09436', // Orange
  '#F75555', // Red
  '#10B981', // Emerald
  '#5E94E4', // Blue
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#F7C948', // Yellow
  '#64748B', // Slate
] as const;

export const DEFAULT_SWATCH_COLOR: string = SWATCH_COLORS[0];
