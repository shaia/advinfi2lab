import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-3/';

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

test.describe('lesson 3.3: the tangent plane, the unit normal and orientability', () => {
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

  test('on the saddle at (0.5, 0.5) N̂ = (−1, 1, 1)/√3, and swapping the parameters flips it and ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    // σ_x × σ_y = (−2x, 2y, 1) = (−1, 1, 1) at (0.5, 0.5); 1/√3 ≈ 0.577
    await expect(fig.locator('[data-readout="normal"]')).toContainText('N̂ = (−0.58, 0.58, 0.58)');
    expect(await task(page, 'fig-3-3a:swap')).toBeFalsy();
    await fig.getByRole('button', { name: 'החלפת סדר הפרמטרים' }).click();
    await expect(fig.locator('[data-readout="normal"]')).toContainText('N̂ = (0.58, −0.58, −0.58)');
    await expect.poll(() => task(page, 'fig-3-3a:swap')).toBeTruthy();
  });

  test('turning the tangent plane edge-on ticks the edge-on task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    expect(await task(page, 'fig-3-3a:edge-on')).toBeFalsy();
    const canvas = fig.locator('canvas');
    await canvas.focus();
    // yaw 0.9: |eye·N̂| drops below sin 8° at pitch 0.05 (three presses) and is ≈ 0.006 at pitch −0.15
    for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowDown');
    await expect.poll(() => task(page, 'fig-3-3a:edge-on')).toBeTruthy();
  });

  test('the Möbius band: N̂(0, 0) = (0, 0, −1), N̂(2π, 0) = (0, 0, 1), and the loop ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3b');
    expect(await task(page, 'fig-3-3b:mobius-loop')).toBeFalsy();
    const slider = fig.getByRole('slider', { name: /^הפרמטר u/ });
    await slider.fill('0');
    await expect(fig.locator('[data-readout="normal"]')).toContainText(', −1)');
    await slider.fill('240');
    await expect(fig.locator('[data-readout="normal"]')).toContainText(', 1)');
    await expect.poll(() => task(page, 'fig-3-3b:mobius-loop')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // steps move the Möbius point from u = 1.5 to u = 6.2 and switch surfaces with the normal shown
    for (const s of await page.locator('.step[data-fig="fig-3-3a"], .step[data-fig="fig-3-3b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-3-3a:swap', 'fig-3-3a:edge-on', 'fig-3-3b:mobius-loop']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.3-normal-saddle', 'Q-3.3-plane-level', 'Q-3.3-velocity', 'Q-3.3-sphere-two', 'Q-3.3-mobius-dot']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
