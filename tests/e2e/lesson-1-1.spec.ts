import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-1/';

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

test.describe('lesson 1.1: smooth and regular curves, image and tangent', () => {
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

  test('(cos 2t, sin 2t) starts a second lap past t = π, and only then the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: 'מעגל, פעמיים', exact: true }).click();
    // a new curve starts at grid index 180 of 600: t = 0.6π, still on the first lap
    expect(await task(page, 'fig-1-1a:second-lap')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowRight', 130); // index 310: t ≈ 1.033π
    await expect.poll(() => task(page, 'fig-1-1a:second-lap')).toBeTruthy();
  });

  test('reversing the direction keeps the image and ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: 'כיוון הפוך', exact: true }).click();
    await expect(fig.locator('[data-readout="point"]')).toContainText('בכיוון ההפוך');
    await expect.poll(() => task(page, 'fig-1-1a:reverse-image')).toBeTruthy();
  });

  test('on the cusp (t², t³) the velocity vanishes at t = 0 and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1b');
    // the figure starts on the cusp at t = −0.5 (grid index 175); 125 steps reach t = 0
    await step(fig.locator('canvas'), 'ArrowRight', 125);
    await expect(fig.locator('[data-readout="velocity"]')).toContainText('γ′(t) = (0, 0)');
    await expect.poll(() => task(page, 'fig-1-1b:cusp-zero')).toBeTruthy();
  });

  test('(t³, t³) also stops at t = 0, and finding it ticks its own task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1b');
    await fig.getByRole('button', { name: 'ישר עם עצירה', exact: true }).click();
    await step(fig.locator('canvas'), 'ArrowRight', 120);
    await expect(fig.locator('[data-readout="velocity"]')).toContainText('γ′(t) = (0, 0)');
    await expect.poll(() => task(page, 'fig-1-1b:slow-line-zero')).toBeTruthy();
  });

  test('the loop passes (0, 1) at t = −1 with velocity (2, −2)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1b');
    await fig.getByRole('button', { name: 'לולאה', exact: true }).click();
    // index 180 is t = −0.6 on [−1.5, 1.5]; 80 steps left reach t = −1
    await step(fig.locator('canvas'), 'ArrowLeft', 80);
    await expect(fig.locator('[data-readout="velocity"]')).toContainText('(2, −2)');
    await expect.poll(() => task(page, 'fig-1-1b:loop-twice')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that reverses the circle or puts the loop at t = −1', async ({ page }) => {
    await page.goto(LESSON);
    for (const s of await page.locator('.step[data-fig="fig-1-1a"], .step[data-fig="fig-1-1b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-1a:reverse-image', 'fig-1-1a:second-lap', 'fig-1-1b:loop-twice', 'fig-1-1b:cusp-zero', 'fig-1-1b:slow-line-zero']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.1-trace', 'Q-1.1-regular-def', 'Q-1.1-tangent-line', 'Q-1.1-cusp', 'Q-1.1-reparam-tangent']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
