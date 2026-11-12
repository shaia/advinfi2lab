import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-2/';

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

test.describe('lesson 3.2: graphs, level sets and change of parameters', () => {
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

  test('the hyperboloid at (1, 0, 0) is regular, and moving to the sphere\'s pole ticks the pole task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    // (cosh v cos u, cosh v sin u, sinh v) at u = v = 0: ‖σ_u × σ_v‖ = cosh v · √(sinh²v + cosh²v) = 1
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('= 1');
    await fig.getByRole('button', { name: 'ספרה, אורך ורוחב' }).click();
    expect(await task(page, 'fig-3-2a:pole')).toBeFalsy();
    // the v slider's last step is v = π/2, the north pole, where σ_u = 0
    await fig.getByRole('slider', { name: /^הפרמטר v/ }).fill('240');
    await expect.poll(() => task(page, 'fig-3-2a:pole')).toBeTruthy();
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('לא רגולרית');
  });

  test('swapping the parameters flips the normal and ticks the swap task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2b');
    const normal = fig.locator('[data-readout="normal"]');
    const before = await normal.textContent();
    expect(await task(page, 'fig-3-2b:swap')).toBeFalsy();
    await fig.getByRole('button', { name: 'החלפת סדר הפרמטרים' }).click();
    await expect.poll(() => task(page, 'fig-3-2b:swap')).toBeTruthy();
    await expect(normal).not.toHaveText(before ?? '');
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // the steps turn on the swap toggle with the normal shown, and move between surfaces
    for (const s of await page.locator('.step[data-fig="fig-3-2a"], .step[data-fig="fig-3-2b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-3-2a:pole', 'fig-3-2b:swap']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.2-graph-cross', 'Q-3.2-level-values', 'Q-3.2-chain', 'Q-3.2-det-factor', 'Q-3.2-why-independent']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
