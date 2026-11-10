import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-5/';

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

test.describe('lesson 2.5 (enrichment): Lancret and spherical curves', () => {
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

  test('on (t, cosh t, sinh t) the angle with the axis stays 45° and τ/κ = 1 wherever the point goes', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5a');
    const axis = fig.locator('[data-readout="axis"]');
    await expect(axis).toContainText('45°');
    expect(await task(page, 'fig-2-5a:helix-angle')).toBeFalsy();
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    // the grid has 600 steps on [−2, 2]: index 100 is t = −4/3, index 500 is t = 4/3
    await slider.fill('100');
    await expect(axis).toContainText('45°');
    await expect(axis).toContainText('τ/κ = 1');
    await slider.fill('500');
    await expect(axis).toContainText('45°');
    await expect.poll(() => task(page, 'fig-2-5a:helix-angle')).toBeTruthy();
  });

  test('on the right-handed helix the Darboux vector is shown and its task ticks on a move', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5a');
    await fig.getByRole('button', { name: 'סליל ימני' }).click();
    // κ = 0.8, τ = 0.4: ‖ω‖ = √0.8 ≈ 0.894, and the angle with the axis is arccos(1/√5) ≈ 63.4°
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.894');
    await expect(fig.locator('[data-readout="axis"]')).toContainText('63.4°');
    expect(await task(page, 'fig-2-5a:darboux-helix')).toBeFalsy();
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('200');
    await expect.poll(() => task(page, 'fig-2-5a:darboux-helix')).toBeTruthy();
  });

  test("Viviani's osculating sphere has radius 2 and its task ticks", async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5b');
    const sphere = fig.locator('[data-readout="sphere"]');
    await expect(sphere).toContainText('= 2');
    // index 320 on [−2π, 2π] is t ≈ 0.419, where τ ≠ 0
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('320');
    await expect(sphere).toContainText('= 2');
    await expect.poll(() => task(page, 'fig-2-5b:viviani-sphere')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    for (const s of await page.locator('.step[data-fig="fig-2-5a"], .step[data-fig="fig-2-5b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-2-5a:helix-angle', 'fig-2-5a:darboux-helix', 'fig-2-5b:viviani-sphere']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.5-def', 'Q-2.5-helix-ratio', 'Q-2.5-tc', 'Q-2.5-sphere-kappa', 'Q-2.5-sphere-R']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
