import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-5/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Move the point along the curve: each arrow key moves the parameter by one of 600 grid steps, Shift by ten. */
async function step(canvas: Locator, key: 'ArrowRight' | 'ArrowLeft', times: number) {
  await canvas.focus();
  for (let i = 0; i < Math.floor(times / 10); i++) await canvas.press(`Shift+${key}`);
  for (let i = 0; i < times % 10; i++) await canvas.press(key);
}

const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 1.5: signed curvature of a plane curve', () => {
  test('both figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('on (t, t³) left of the origin k < 0, and moving the point there ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    await fig.getByRole('button', { name: 'הגרף של x³' }).click();
    // a new curve starts at grid index 180 of 600: t = −0.52, already turning right, but the reader has not moved it
    expect(await task(page, 'fig-1-5a:turn-right')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowRight', 1);
    await expect(fig.locator('[data-readout="signed"]')).toContainText('פונה ימינה');
    await expect.poll(() => task(page, 'fig-1-5a:turn-right')).toBeTruthy();
  });

  test('reversing the ellipse flips the sign of k, and the reversal ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    await expect(fig.locator('[data-readout="signed"]')).toContainText('פונה שמאלה');
    await fig.getByRole('button', { name: 'כיוון הפוך' }).click();
    await expect(fig.locator('[data-readout="signed"]')).toContainText('k = −');
    await expect(fig.locator('[data-readout="signed"]')).toContainText('פונה ימינה');
    await expect.poll(() => task(page, 'fig-1-5a:reverse-sign')).toBeTruthy();
  });

  test('the figure eight turns 0 in total, and reaching its end ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await fig.getByRole('button', { name: 'שמינייה' }).click();
    // the parameter slider straight to grid index 600, the end of the curve (420 key presses timed out under load)
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('600');
    await expect(fig.locator('[data-readout="angle"]')).toContainText('השינוי מתחילת המסילה 0,');
    await expect.poll(() => task(page, 'fig-1-5b:eight-total')).toBeTruthy();
  });

  test('the ellipse turns 2π once around', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await fig.getByRole('button', { name: 'שמינייה' }).click();
    await fig.getByRole('button', { name: 'אליפסה' }).click();
    // the parameter slider straight to grid index 600, the end of the curve (420 key presses timed out under load)
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('600');
    await expect(fig.locator('[data-readout="angle"]')).toContainText('השינוי מתחילת המסילה 6.28');
  });

  test('a text step never ticks a task, even one that puts the point on the answer', async ({ page }) => {
    await page.goto(LESSON);
    // steps put the cubic at t = −0.5 (k < 0) and reverse the ellipse; none of that is the reader's doing
    for (const s of await page.locator('.step[data-fig="fig-1-5a"], .step[data-fig="fig-1-5b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-5a:turn-right', 'fig-1-5a:reverse-sign', 'fig-1-5b:eight-total']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.5-ns', 'Q-1.5-clockwise', 'Q-1.5-reflect-num', 'Q-1.5-theta', 'Q-1.5-dtheta-proof']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
