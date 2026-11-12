import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-5/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 3.5: local isometries and intrinsic geometry', () => {
  test('all three figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('rolling the strip keeps E, F, G and the length of the line, and ticks bend-full', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    // the line y = 0.75 + x/4 over −π ≤ x ≤ π has length π√17/2 ≈ 6.477 at every bending
    await expect(fig.locator('[data-readout="form"]')).toContainText('E = 1, F = 0, G = 1');
    await expect(fig.locator('[data-readout="length"]')).toContainText('6.477');
    expect(await task(page, 'fig-3-5a:bend-full')).toBeFalsy();
    await fig.getByRole('slider', { name: /^גלגול/ }).fill('100');
    await expect.poll(() => task(page, 'fig-3-5a:bend-full')).toBeTruthy();
    await expect(fig.locator('[data-readout="form"]')).toContainText('E = 1, F = 0, G = 1');
    await expect(fig.locator('[data-readout="length"]')).toContainText('6.477');
  });

  test('rolling the sector onto the cone keeps the chord length 2.2, and ticks bend-full', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5b');
    // at r = 1: E = 1, F = 0, G = r² = 1, for every k
    await expect(fig.locator('[data-readout="form"]')).toContainText('E = 1, F = 0, G = 1');
    await expect(fig.locator('[data-readout="length"]')).toContainText('2.2');
    await fig.getByRole('slider', { name: /^גלגול/ }).fill('100');
    await expect.poll(() => task(page, 'fig-3-5b:bend-full')).toBeTruthy();
    await expect(fig.locator('[data-readout="length"]')).toContainText('2.2');
  });

  test('the intrinsic circle of radius π/6 about the pole has length π', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5c');
    await expect(fig.locator('[data-readout="length"]')).toContainText('3.142');
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // steps set the bending to 1 on both rolling figures
    for (const s of await page.locator('.step[data-fig="fig-3-5a"], .step[data-fig="fig-3-5b"], .step[data-fig="fig-3-5c"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-3-5a:bend-full', 'fig-3-5b:bend-full']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.5-def', 'Q-3.5-intrinsic', 'Q-3.5-wrap', 'Q-3.5-cone-angle', 'Q-3.5-helix-curvature']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
