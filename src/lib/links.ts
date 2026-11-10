/**
 * Where a lesson, or a misconception's remedy, points while the course is being written. The question
 * banks of every chapter exist before its lessons do, so a link to an unwritten lesson goes to that
 * lesson's section of the chapter practice page instead of a page that does not exist.
 */

import { getCollection } from 'astro:content';
import { chapterOf, lessonSlug } from '~/course';
import { tex } from './tex';
import { url } from './url';

/** Lesson ids that have a published page (drafts count only in dev). */
export async function writtenLessons(): Promise<Set<string>> {
  return new Set((await getCollection('lessons', (e) => !e.data.draft || import.meta.env.DEV)).map((e) => e.data.id));
}

/** The lesson page when it is written, otherwise its group on the chapter practice page. */
export function lessonHref(id: string, written: Set<string>, anchor?: string): string {
  if (written.has(id)) return url(`lessons/${lessonSlug(id)}/${anchor ? `#${anchor}` : ''}`);
  return url(`practice/ch${chapterOf(id)?.n ?? id.split('.')[0]}/#pl-${lessonSlug(id)}`);
}

/** Every misconception with its remedy link resolved and its truth rendered, for the test report and My Path. */
export async function misconceptionLinks(written: Set<string>) {
  return Object.fromEntries(
    (await getCollection('misconceptions')).map((m) => [
      m.data.id,
      {
        title: m.data.title,
        // HTML: the truth may carry TeX, rendered here at build time
        truth: tex(m.data.truth, `${m.data.id}.truth`),
        label: m.data.remedy.label,
        href: lessonHref(m.data.remedy.lesson, written, m.data.remedy.anchor),
      },
    ]),
  );
}
