import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-3/';

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

test.describe('lesson 2.3: the Frenet–Serret equations', () => {
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

  test('the helix has κ = 0.8, τ = 0.4, and the fast helix has the same values (task fast-same)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3a');
    await expect(fig.locator('[data-readout="kappa"]')).toContainText('κ = 0.8');
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0.4');
    await fig.getByRole('button', { name: 'סליל ימני, מהיר פי 2' }).click();
    expect(await task(page, 'fig-2-3a:fast-same')).toBeFalsy();
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('420');
    await expect(fig.locator('[data-readout="kappa"]')).toContainText('κ = 0.8');
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0.4');
    await expect.poll(() => task(page, 'fig-2-3a:fast-same')).toBeTruthy();
  });

  test('the Darboux vector of the helix has length √(κ² + τ²) ≈ 0.894, and moving along ticks its task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3a');
    await fig.getByRole('button', { name: 'וקטור דרבו ω' }).click();
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.894');
    await fig.getByRole('slider', { name: /^הפרמטר t/ }).fill('100');
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.894');
    await expect.poll(() => task(page, 'fig-2-3a:darboux-helix')).toBeTruthy();
  });

  test('turning the view until the osculating plane of the cubic is edge-on ticks its task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3a');
    // choosing the cubic puts the point at t = 0, where b = (0, 0, 1) and τ = 3
    await fig.getByRole('button', { name: 'המסילה המעוקבת' }).click();
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 3');
    await fig.getByRole('button', { name: 'המישור המנשק' }).click();
    // the view starts at elevation 0.35; three steps of −0.1 bring it to 0.05 < 8°, so the plane z = 0 is seen edge-on
    const canvas = fig.locator('canvas');
    await canvas.focus();
    for (let k = 0; k < 2; k++) await canvas.press('ArrowDown');
    expect(await task(page, 'fig-2-3a:edge-on')).toBeFalsy();
    await canvas.press('ArrowDown');
    await expect.poll(() => task(page, 'fig-2-3a:edge-on')).toBeTruthy();
  });

  test('constant κ and τ rebuild a helix of radius κ/(κ² + τ²), and changing τ ticks the helix task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3b');
    // κ = τ = 1: a = 1/2, the answer to the prediction
    await expect(fig.locator('[data-readout="helix"]')).toContainText('= 0.5');
    expect(await task(page, 'fig-2-3b:helix')).toBeFalsy();
    await fig.getByRole('slider', { name: /^הפרמטר c₂/ }).fill('0.5');
    // κ = 1, τ = 0.5: a = 1/1.25 = 0.8
    await expect(fig.locator('[data-readout="helix"]')).toContainText('= 0.8');
    await expect.poll(() => task(page, 'fig-2-3b:helix')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // steps choose the fast helix, show ω on the helix, and turn the view of the cubic edge-on
    for (const s of await page.locator('.step[data-fig="fig-2-3a"], .step[data-fig="fig-2-3b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-2-3a:darboux-helix', 'fig-2-3a:fast-same', 'fig-2-3a:edge-on', 'fig-2-3b:helix']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.3-nprime', 'Q-2.3-matrix', 'Q-2.3-g3b', 'Q-2.3-helixradius', 'Q-2.3-g2general']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
