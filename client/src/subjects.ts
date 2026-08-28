// Which subjects a kid is offered, and in what order.
//
// English is the fiddly one: it's a single subject up to Year 9, then splits
// into two separate GCSEs (Language and Literature) that carry on to A-level.
// US families keep the one "Reading & Writing" coach at every grade.

export interface SubjectRule {
  id: string;
  ukOnly?: boolean;
  /** UK years only: hidden below this year */
  minYear?: number;
  /** UK years only: hidden above this year */
  maxYear?: number;
}

export const SUBJECT_RULES: SubjectRule[] = [
  { id: 'math' },
  { id: 'reading', maxYear: 9 },
  { id: 'englishlang', ukOnly: true, minYear: 10 },
  { id: 'englishlit', ukOnly: true, minYear: 10 },
  { id: 'science' },
  { id: 'geography' },
  { id: 'history' },
  { id: 'french' },
  { id: 'spanish' },
  { id: 'furthermaths', ukOnly: true, minYear: 9 },
];

export function visibleSubjectIds(curriculum: string | undefined, year: number): string[] {
  const isUk = curriculum === 'uk';
  return SUBJECT_RULES.filter(rule => {
    if (rule.ukOnly && !isUk) return false;
    if (!isUk) return true; // year rules describe UK key stages only
    if (rule.minYear !== undefined && year < rule.minYear) return false;
    if (rule.maxYear !== undefined && year > rule.maxYear) return false;
    return true;
  }).map(rule => rule.id);
}

// The daily challenge is generated without knowing the kid's year, so it can
// name a subject they aren't offered - at GCSE "reading" means English Language.
export function resolveSubjectId(id: string, curriculum: string | undefined, year: number): string {
  const available = visibleSubjectIds(curriculum, year);
  if (available.includes(id)) return id;
  if (id === 'reading' && available.includes('englishlang')) return 'englishlang';
  return available[0] ?? 'math';
}
