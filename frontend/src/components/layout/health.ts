import type { Health } from '@/lib/api/types';

export type HealthTone = 'ok' | 'degraded' | 'down' | 'checking';

export interface HealthSummary {
  tone: HealthTone;
  label: string;
  /** Per-component detail for the Settings page and the pill tooltip. */
  details: string[];
  /** Document search (Qdrant) is not reachable. */
  documentsOffline: boolean;
}

const bad = (value: string | undefined) => (value ?? '').startsWith('unhealthy') || (value ?? '').startsWith('unreachable');

/** Turn the /health payload (or its failure) into the status pill's text and colour. */
export function summarizeHealth(health: Health | undefined, error: unknown, isPending: boolean): HealthSummary {
  if (error) return { tone: 'down', label: 'Backend offline', details: ['The CogniTwin backend did not respond.'], documentsOffline: true };
  if (!health) return { tone: isPending ? 'checking' : 'down', label: isPending ? 'Checking…' : 'Backend offline', details: [], documentsOffline: false };

  const c = health.components;
  const documentsOffline = bad(c.qdrant);
  const details = Object.entries(c).map(([name, state]) => `${name.replace(/_/g, ' ')}: ${state}`);

  if (bad(c.database)) return { tone: 'down', label: 'Database unavailable', details, documentsOffline };

  const problems: string[] = [];
  if (documentsOffline) problems.push('document search offline');
  if (c.llm_api_key === 'missing') problems.push('AI answers unavailable');
  if (c.model_directory === 'inaccessible') problems.push('model storage unavailable');

  if (health.status === 'ok' && problems.length === 0) return { tone: 'ok', label: 'All systems normal', details, documentsOffline: false };
  return { tone: 'degraded', label: `Degraded: ${problems.join(', ') || 'some services need attention'}`, details, documentsOffline };
}
