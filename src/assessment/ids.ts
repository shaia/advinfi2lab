/** Id conventions, shared by build-time pages and browser islands (no Astro imports here). */

/**
 * "Q-1.5-ratio" → "1.5". A chapter's review questions ("Q-1-review-07") and exam questions ("Q-1-exam-2")
 * belong to no single lesson.
 */
export function lessonOfQuestion(id: string): string | null {
  return id.match(/^Q-(\d+\.\d+)-/)?.[1] ?? null;
}

/** "Q-1-review-07" → true: a review question of a whole chapter, mixing its lessons. */
export const isReview = (id: string): boolean => /^Q-\d+-review-\d{2}$/.test(id);

/** "OBJ-1.5-3" → "1.5" */
export function lessonOfObjective(id: string): string | null {
  return id.match(/^OBJ-(\d+\.\d+)-/)?.[1] ?? null;
}
