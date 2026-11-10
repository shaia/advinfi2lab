import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-2/';

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

test.describe('lesson 2.2: torsion', () => {
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

  test('the right-handed helix: κ = 0.8, τ = 0.4; a reflection flips τ, a reversal does not', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2a');
    const tau = fig.locator('[data-readout="tau"] b');
    await expect(fig.locator('[data-readout="kappa"] b')).toHaveText('κ = 0.8');
    await expect(tau).toHaveText('τ = 0.4');
    await fig.getByRole('button', { name: 'כיוון הפוך' }).click();
    await expect(tau).toHaveText('τ = 0.4');
    await expect.poll(() => task(page, 'fig-2-2a:reverse')).toBeTruthy();
    await fig.getByRole('button', { name: 'שיקוף במישור z = 0' }).click();
    await expect(tau).toHaveText('τ = −0.4');
    await expect(fig.locator('[data-readout="kappa"] b')).toHaveText('κ = 0.8');
    await expect.poll(() => task(page, 'fig-2-2a:mirror')).toBeTruthy();
  });

  test('the twisted cubic has its largest torsion, 3, at t = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2a');
    await fig.getByRole('button', { name: 'המסילה המעוקבת' }).click();
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    // the grid has 600 steps on [−1.2, 1.2]: index 250 is t = −0.2, index 300 is t = 0
    await slider.fill('250');
    expect(await task(page, 'fig-2-2a:cubic-max')).toBeFalsy();
    await slider.fill('300');
    await expect(fig.locator('[data-readout="tau"] b')).toHaveText('τ = 3');
    await expect.poll(() => task(page, 'fig-2-2a:cubic-max')).toBeTruthy();
  });

  test('the saddle curve has torsion of both signs', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2a');
    await fig.getByRole('button', { name: 'מסילה על אוכף' }).click();
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    // index 50 is t = π/6 (τ > 0), index 200 is t = 2π/3 (τ = 6 sin(4π/3)/(5 + 3) ≈ −0.65)
    await slider.fill('50');
    await slider.fill('200');
    await expect(fig.locator('[data-readout="tau"] b')).toHaveText('τ = −0.65');
    await expect.poll(() => task(page, 'fig-2-2a:saddle-sign')).toBeTruthy();
  });

  test('the tilted planar curve has τ = 0 at every point the reader visits', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2b');
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    for (const i of ['40', '333', '520']) {
      await slider.fill(i);
      await expect(fig.locator('[data-readout="tau"] b')).toHaveText('τ = 0');
    }
    await expect.poll(() => task(page, 'fig-2-2b:planar-zero')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that shows the left-handed helix or the cubic at t = 0', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    for (const s of await page.locator('.step[data-fig="fig-2-2a"], .step[data-fig="fig-2-2b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-2-2a:mirror', 'fig-2-2a:reverse', 'fig-2-2a:cubic-max', 'fig-2-2a:saddle-sign', 'fig-2-2b:planar-zero', 'fig-2-2b:edge-on']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.2-sign', 'Q-2.2-helix', 'Q-2.2-formula', 'Q-2.2-orient', 'Q-2.2-planar-proof']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
