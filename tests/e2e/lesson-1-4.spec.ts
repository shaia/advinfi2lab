import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-4/';

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

test.describe('lesson 1.4: radius of curvature and the osculating circle', () => {
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

  test('on the ellipse (2cos t, sin t) ρ = 4 with centre (0, −3) at (0, 1), and ρ = 1/2 at (2, 0); both tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    const canvas = fig.locator('canvas');
    // the figure starts at t = 1: grid index 95 of 600; index 150 is t = π/2, the point (0, 1)
    expect(await task(page, 'fig-1-4a:ellipse-max')).toBeFalsy();
    await step(canvas, 'ArrowRight', 55);
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('ρ = 1/κ = 4');
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('(0, −3)');
    await expect.poll(() => task(page, 'fig-1-4a:ellipse-max')).toBeTruthy();
    // index 0 is t = 0, the point (2, 0)
    await step(canvas, 'ArrowLeft', 150);
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('ρ = 1/κ = 0.5');
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('(1.5, 0)');
    await expect.poll(() => task(page, 'fig-1-4a:ellipse-min')).toBeTruthy();
  });

  test('the centre of curvature at the vertex of y = x² is (0, 1/2), not the focus', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    await fig.getByRole('button', { name: 'פרבולה' }).click();
    // a new curve starts at grid index 180 (t = −0.6); index 300 is the vertex t = 0
    expect(await task(page, 'fig-1-4a:parabola-vertex')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowRight', 120);
    await expect(fig.locator('[data-readout="point"]')).toContainText('t = 0');
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('(0, 0.5)');
    await expect.poll(() => task(page, 'fig-1-4a:parabola-vertex')).toBeTruthy();
  });

  test('the graph of eˣ is most curved near x = −ln2/2, not at the elbow x = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4b');
    // the figure starts at t = 0: grid index 405 of 600 on [−2.5, 1.2]
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('κ = 0.35');
    expect(await task(page, 'fig-1-4b:exp-max')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowLeft', 56); // index 349: t ≈ −0.348
    await expect(fig.locator('[data-readout="curvature"]')).toContainText('κ = 0.385');
    await expect.poll(() => task(page, 'fig-1-4b:exp-max')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that puts the point on the answer', async ({ page }) => {
    await page.goto(LESSON);
    // steps of 1.4א put the parabola at its vertex and the ellipse at (2, 0); a step of 1.4ב puts eˣ at x = −0.35
    for (const s of await page.locator('.step[data-fig="fig-1-4a"], .step[data-fig="fig-1-4b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-4a:ellipse-min', 'fig-1-4a:ellipse-max', 'fig-1-4a:parabola-vertex', 'fig-1-4b:exp-max']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.4-order', 'Q-1.4-graph-formula', 'Q-1.4-cubic-graph', 'Q-1.4-ellipse-centre', 'Q-1.4-distance']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
