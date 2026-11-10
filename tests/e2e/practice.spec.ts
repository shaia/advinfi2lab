import { expect, test } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chapters, lessonSlug } from '../../src/course';
import { hydrated } from './helpers';

/**
 * The self-study path of every chapter that has question banks: understanding questions for every planned lesson,
 * then the review questions, then the exam questions, with a filter that shows one stage at a time. The practice page
 * is the entry point while lessons are unwritten, so a missing lesson group is a hole in the path.
 */

const DIST = join(import.meta.dirname, '../../dist');
const built = existsSync(join(DIST, 'practice')) ? readdirSync(join(DIST, 'practice')).map((d) => Number(d.replace('ch', ''))) : [];

for (const n of built) {
  const chapter = chapters.find((c) => c.n === n)!;
  const path = `/practice/ch${n}/`;

  test.describe(path, () => {
    test('has an understanding group for every lesson, then review and exam sections', async ({ page }) => {
      await page.goto(path);
      for (const l of chapter.lessons) {
        await expect(page.locator(`#pl-${lessonSlug(l.id)}`), `lesson ${l.id}`).toHaveCount(1);
      }
      await expect(page.locator('[data-review-group] [data-qid]').first()).toBeAttached();
      await expect(page.locator('[data-exam-group] article.exam')).not.toHaveCount(0);
      // the stages come in the order the student works through them
      const order = await page.evaluate(() =>
        [...document.querySelectorAll('[data-lesson-group], [data-review-group], [data-exam-group]')].map((e) =>
          e.hasAttribute('data-review-group') ? 'review' : e.hasAttribute('data-exam-group') ? 'exam' : 'lesson',
        ),
      );
      expect(order.lastIndexOf('lesson')).toBeLessThan(order.indexOf('review'));
      expect(order.indexOf('review')).toBeLessThan(order.indexOf('exam'));
    });

    test('the filter shows one stage at a time', async ({ page }) => {
      await page.goto(path);
      await page.getByRole('button', { name: /^שאלות חזרה/ }).click();
      await expect(page.locator('[data-review-group]')).toBeVisible();
      await expect(page.locator('[data-exam-group]')).toBeHidden();
      await expect(page.locator('[data-lesson-group]:visible')).toHaveCount(0);
      await page.getByRole('button', { name: /^שאלות מבחן/ }).click();
      await expect(page.locator('[data-exam-group]')).toBeVisible();
      await expect(page.locator('[data-review-group]')).toBeHidden();
      await page.getByRole('button', { name: /^הכול/ }).click();
      await expect(page.locator('[data-review-group]')).toBeVisible();
    });

    test('an understanding question can be answered and gives feedback', async ({ page }) => {
      await page.goto(path);
      const card = page.locator('[data-lesson-group] [data-type="mc"]').first();
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input[type="radio"]').first().check();
      await card.getByRole('button', { name: /בדיקה/ }).first().click();
      await expect(card.locator('.q-feedback')).toBeVisible();
    });
  });
}

test('the contents page links every planned lesson of a chapter with questions to its practice group', async ({ page }) => {
  await page.goto('/');
  for (const n of built) {
    for (const l of chapters.find((c) => c.n === n)!.lessons) {
      const a = page.locator(`[data-lesson-id="${l.id}"] a`);
      await expect(a, `lesson ${l.id}`).toHaveAttribute('href', new RegExp(`(lessons/${lessonSlug(l.id)}/|practice/ch${n}/#pl-${lessonSlug(l.id)})$`));
    }
  }
});
