import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-2/';

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

test.describe('lesson 1.2: arc length and the arc-length parameter', () => {
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

  test('on the cycloid one segment gives 2π, and 7 segments is the first within 1% of 8', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-2a');
    const readout = fig.locator('[data-readout="polygon"]');
    await expect(readout).toContainText('6.283');
    const slider = fig.getByRole('slider', { name: /מספר הקטעים/ });
    await slider.fill('6'); // 7.9145: 1.07% short
    await expect(readout).toContainText('7.915');
    expect(await task(page, 'fig-1-2a:polygon-cycloid')).toBeFalsy();
    await slider.fill('7'); // 7.9362: 0.80% short
    await expect(readout).toContainText('7.936');
    await expect.poll(() => task(page, 'fig-1-2a:polygon-cycloid')).toBeTruthy();
    await expect.poll(() => task(page, 'fig-1-2a:polygon-close')).toBeTruthy();
  });

  test('on the logarithmic spiral, half the length is reached before the middle of the parameter', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-2b');
    await fig.getByRole('button', { name: 'ספירלה לוגריתמית' }).click();
    // a new curve starts at grid index 180 (t ≈ 3.770, s ≈ 2.700); L/2 ≈ 2.343 is at index 147
    expect(await task(page, 'fig-1-2b:arclength-half')).toBeFalsy();
    await step(fig.locator('canvas'), 'ArrowLeft', 33);
    await expect(fig.locator('[data-readout="arclength"]')).toContainText('2.344');
    await expect(fig.locator('[data-readout="arclength"]')).toContainText('4.686');
    await expect.poll(() => task(page, 'fig-1-2b:arclength-half')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that puts the figure on the answer', async ({ page }) => {
    await page.goto(LESSON);
    // a step of 1.2א shows the cycloid with 8 segments (within 1%); a step of 1.2ב puts the spiral at half its length
    for (const s of await page.locator('.step[data-fig="fig-1-2a"], .step[data-fig="fig-1-2b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-2a:polygon-close', 'fig-1-2a:polygon-cycloid', 'fig-1-2b:arclength-half']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.2-sup', 'Q-1.2-helix', 'Q-1.2-reverse', 'Q-1.2-chord', 'Q-1.2-which-arclength']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
