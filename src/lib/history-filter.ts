import type { Language } from '../data/articles';
import type { PracticeMode, PracticeRecord } from './models';

export type HistoryFilters = {
  query: string;
  from: string;
  to: string;
  language: Language | '';
  mode: PracticeMode | '';
  minutes: string;
  strict: '' | 'yes' | 'no';
};
export const emptyHistoryFilters: HistoryFilters = { query: '', from: '', to: '', language: '', mode: '', minutes: '', strict: '' };

function localDay(timestamp: number) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function filterPracticeRecords(records: PracticeRecord[], filters: HistoryFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const day = localDay(record.finishedAt);
    return (!query || (record.article?.title ?? '').toLocaleLowerCase().includes(query)) &&
      (!filters.from || (!!day && day >= filters.from)) && (!filters.to || (!!day && day <= filters.to)) &&
      (!filters.language || record.language === filters.language) && (!filters.mode || (record.mode ?? 'timed') === filters.mode) &&
      (!filters.minutes || record.duration === Number(filters.minutes) * 60) &&
      (!filters.strict || !!record.strict === (filters.strict === 'yes'));
  }).sort((a, b) => b.finishedAt - a.finishedAt);
}
