import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-6/';

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

test.describe('lesson 1.6: the plane curve is determined by its signed curvature', () => {
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

  test('k ≡ 1 closes after length 2π: the end returns to the start and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-6a');
    // the figure starts with k ≡ 1 and L = 4: the end is |γ(4)| = 2 sin 2 ≈ 1.82 from the start
    expect(await task(page, 'fig-1-6a:close-circle')).toBeFalsy();
    await fig.getByRole('slider', { name: /^האורך\ L/ }).fill('6.28');
    // |γ(6.28)| = 2 sin(3.14) ≈ 0.00319, printed by sci() as 3.19·10⁻³
    await expect(fig.locator('[data-readout="gap"] b')).toHaveText('3.19·10⁻³');
    await expect.poll(() => task(page, 'fig-1-6a:close-circle')).toBeTruthy();
  });

  test('the Cornu spiral of length 10 ticks its task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-6a');
    await fig.getByRole('button', { name: 'ספירלת קורנו' }).click();
    await fig.getByRole('slider', { name: /^האורך\ L/ }).fill('10');
    await expect(fig.locator('[data-readout="law"]')).toContainText('k(s) = c·s');
    await expect.poll(() => task(page, 'fig-1-6a:cornu')).toBeTruthy();
  });

  test('turning θ₀ rotates the curve and reflecting k mirrors it: the end-to-start distance never changes', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-6b');
    const gap = fig.locator('[data-readout="gap"] b');
    const before = await gap.textContent();
    await fig.getByRole('slider', { name: /^זווית\ ההתחלה\ θ₀/ }).fill('1');
    await expect(gap).toHaveText(before!);
    await expect.poll(() => task(page, 'fig-1-6b:rotate')).toBeTruthy();
    await fig.getByRole('slider', { name: /^הפרמטר\ c/ }).fill('-1');
    await expect(gap).toHaveText(before!);
    await expect.poll(() => task(page, 'fig-1-6b:mirror')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that closes the circle, rotates or mirrors', async ({ page }) => {
    await page.goto(LESSON);
    // steps put k ≡ 1 with L = 6.28 (closed), θ₀ = 1.2 (rotated) and c = −1 in k = cs (mirrored)
    for (const s of await page.locator('.step[data-fig="fig-1-6a"], .step[data-fig="fig-1-6b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-6a:close-circle', 'fig-1-6a:cornu', 'fig-1-6b:rotate', 'fig-1-6b:mirror']) expect(await task(page, id)).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.6-recipe', 'Q-1.6-circle-num', 'Q-1.6-vertical', 'Q-1.6-uniqueness-proof', 'Q-1.6-closed-length']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
