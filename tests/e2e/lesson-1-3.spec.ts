import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-3/';

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

test.describe('lesson 1.3: unit tangent, curvature and principal normal', () => {
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

  test('on the circle κ = 1 wherever the point is, and moving it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('κ = 1');
    await step(fig.locator('canvas'), 'ArrowRight', 37);
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('κ = 1');
    await expect.poll(() => task(page, 'fig-1-3a:circle-curvature')).toBeTruthy();
  });

  test('the ellipse (2cos t, sin t) reaches κ = 2 at (2, 0), and only there the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    await fig.getByRole('button', { name: 'אליפסה' }).click();
    // a new curve starts 30% along the parameter (grid index 180 of 600): t = 0.6π, not a vertex
    expect(await task(page, 'fig-1-3a:ellipse-max-k')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowRight', 120); // index 300: t = π, the point (−2, 0)
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('κ = 2');
    await expect.poll(() => task(page, 'fig-1-3a:ellipse-max-k')).toBeTruthy();
  });

  test('on (t, t³) at t = 0 the curvature vanishes, there is no principal normal, and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3b');
    await fig.getByRole('button', { name: 'הגרף של x³' }).click();
    await step(fig.locator('canvas'), 'ArrowRight', 120);
    await expect(fig.locator('[data-readout="point"]')).toContainText('t = 0');
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('אין נורמל ראשי');
    await expect.poll(() => task(page, 'fig-1-3b:inflection')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that puts the point on the answer', async ({ page }) => {
    await page.goto(LESSON);
    // steps of 1.3א put the ellipse at t = 0 (κ = 2) and the cubic at t = 0; steps of 1.3ב visit the cubic too
    for (const s of await page.locator('.step[data-fig="fig-1-3a"], .step[data-fig="fig-1-3b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-3a:ellipse-max-k', 'fig-1-3a:circle-curvature', 'fig-1-3b:inflection']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.3-circle', 'Q-1.3-fastcircle', 'Q-1.3-ellipse', 'Q-1.3-helix-normal', 'Q-1.3-normal-proof']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
