/**
 * Ask AI helpers. The backend's /query response does not say where an answer came from, so the
 * source chip is inferred from what the response contains, and is left out when unclear.
 */
import type { AnswerSource } from '@/components/ui/source-chip';
import type { QueryResponse } from '@/lib/api/types';

export const STARTER_QUESTIONS = [
  'Which products brought in the most revenue?',
  'How is revenue trending over the last few months?',
  'Which category sells best on weekends?',
  'What will next month look like?',
] as const;

export const QUESTION_MIN = 5;
export const QUESTION_MAX = 500;

export function validateQuestion(question: string): string | null {
  const q = question.trim();
  if (q.length < QUESTION_MIN) return `Ask something at least ${QUESTION_MIN} characters long.`;
  if (q.length > QUESTION_MAX) return `Keep questions under ${QUESTION_MAX} characters (this one is ${q.length}).`;
  return null;
}

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && !Array.isArray(r)) : [];
}

export function inferSource(response: QueryResponse): AnswerSource | null {
  const data = rows(response.raw_data);
  const text = `${response.answer} ${response.insights?.join(' ') ?? ''}`.toLowerCase();
  if (data.some((r) => 'chunk_id' in r || 'document_id' in r || 'text_snippet' in r || ('text' in r && 'score' in r))) return 'documents';
  if (/pearson|spearman|correlat/.test(text)) return 'relationship';
  if (response.generated_sql && response.generated_sql.trim() !== '') return 'data';
  if (response.charts?.some((c) => c.y_keys.some((k) => /predict|baseline|forecast|mutated/i.test(k)))) return 'forecast';
  return null;
}

/** Tabular view of `raw_data` when it is a list of flat records. */
export function tableRows(response: QueryResponse, limit = 50): Array<Record<string, unknown>> {
  return rows(response.raw_data).slice(0, limit);
}
