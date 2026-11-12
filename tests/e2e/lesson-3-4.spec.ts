import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-4/';

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

test.describe('lesson 3.4: the first fundamental form', () => {
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

  test('the latitude v = π/3 on the unit sphere: E = 1/4, length π on the sphere and 2π in the domain; moving its end ticks curve-full', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    // v = π/3 sits exactly on the slider grid (index 200 of 240 on [−π/2, π/2])
    await expect(fig.locator('[data-readout="form"]')).toContainText('E = 0.25');
    await expect(fig.locator('[data-readout="length"]')).toContainText('3.142');
    await expect(fig.locator('[data-readout="length"]')).toContainText('6.283');
    expect(await task(page, 'fig-3-4a:curve-full')).toBeFalsy();
    const end = fig.getByRole('slider', { name: /^סוף המסילה/ });
    await end.fill('150');
    await expect(fig.locator('[data-readout="length"]')).toContainText('1.571');
    await end.fill('300');
    await expect.poll(() => task(page, 'fig-3-4a:curve-full')).toBeTruthy();
  });

  test('the saddle at (1/2, 1/2): cos θ = −0.5; moving to x = 0 makes the parameter curves orthogonal and ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4b');
    // σ_x = (1, 0, 1), σ_y = (0, 1, −1): E = G = 2, F = −1
    await expect(fig.locator('[data-readout="form"]')).toContainText('F = −1');
    await expect(fig.locator('[data-readout="form"]')).toContainText('−0.5');
    expect(await task(page, 'fig-3-4b:orthogonal')).toBeFalsy();
    await fig.getByRole('slider', { name: /^הפרמטר x/ }).fill('120');
    await expect.poll(() => task(page, 'fig-3-4b:orthogonal')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    for (const s of await page.locator('.step[data-fig="fig-3-4a"], .step[data-fig="fig-3-4b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-3-4a:curve-full', 'fig-3-4b:orthogonal']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.4-sphere-efg', 'Q-3.4-restriction', 'Q-3.4-oblique', 'Q-3.4-param-angle', 'Q-3.4-positive']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
