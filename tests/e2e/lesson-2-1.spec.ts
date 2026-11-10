import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-1/';

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

test.describe('lesson 2.1: the Frenet frame and the osculating plane', () => {
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

  test('the helix readout shows κ = 0.8, and looking down the axis ticks the top-view task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    // helix (cos t, sin t, t/2): κ = 1/(1 + 1/4) = 0.8 at every point
    await expect(fig.locator('[data-readout="kappa"]')).toContainText('κ = 0.8');
    expect(await task(page, 'fig-2-1a:top-view')).toBeFalsy();
    const canvas = fig.locator('canvas');
    await canvas.focus();
    // pitch 0.35 + 12 × 0.1, clamped at 1.5: the eye is within 12° of the axis
    for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowUp');
    await expect.poll(() => task(page, 'fig-2-1a:top-view')).toBeTruthy();
  });

  test('turning the osculating plane edge-on ticks the edge-on task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    await fig.getByRole('button', { name: 'המישור המנשק' }).click();
    const canvas = fig.locator('canvas');
    await canvas.focus();
    // at t ≈ 0.6 on the helix, b·eye changes sign near pitch 0.15; pitch 0.25 is within 8° of edge-on
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => task(page, 'fig-2-1a:edge-on')).toBeTruthy();
  });

  test('the glued curve: κ = 0 at t = 0, and crossing t = 0 ticks the jump task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1b');
    await fig.getByRole('button', { name: 'מסילה מודבקת' }).click();
    // choosing the curve puts the point at t = 0, where κ = 0 and the frame is undefined
    await expect(fig.locator('[data-readout="kappa"]')).toContainText('κ = 0');
    expect(await task(page, 'fig-2-1b:jump')).toBeFalsy();
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    await slider.fill('200');
    await slider.fill('400');
    await expect.poll(() => task(page, 'fig-2-1b:jump')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // steps put the glued curve on both sides of 0 and turn the view close to edge-on
    for (const s of await page.locator('.step[data-fig="fig-2-1a"], .step[data-fig="fig-2-1b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-2-1a:top-view', 'fig-2-1a:edge-on', 'fig-2-1b:jump']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.1-bdef', 'Q-2.1-tc-frame0', 'Q-2.1-bgeneral', 'Q-2.1-oscz', 'Q-2.1-jump']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
