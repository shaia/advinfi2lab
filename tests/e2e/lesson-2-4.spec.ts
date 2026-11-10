import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-4/';

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

test.describe('lesson 2.4: the existence and uniqueness theorem for space curves', () => {
  test('all three figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('κ = τ = 1/2 is the helix of radius 1; τ = 0 flattens it and changing only τ ticks same-kappa', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4a');
    // a = κ/(κ² + τ²) = 0.5/0.5 = 1 (example 1 of the lesson)
    await expect(fig.locator('[data-readout="helix"] b')).toContainText('= 1');
    expect(await task(page, 'fig-2-4a:flat')).toBeFalsy();
    await fig.getByRole('slider', { name: /^הפרמטר c₂/ }).fill('0');
    // τ ≡ 0: no helix readout any more (a circle of radius 2)
    await expect(fig.locator('[data-readout="helix"]')).toHaveCount(0);
    await expect.poll(() => task(page, 'fig-2-4a:flat')).toBeTruthy();
    await expect.poll(() => task(page, 'fig-2-4a:same-kappa')).toBeTruthy();
    await fig.getByRole('slider', { name: /^הפרמטר c₂/ }).fill('0.4');
    await expect.poll(() => task(page, 'fig-2-4a:helix')).toBeTruthy();
  });

  test('rotating the starting frame and flipping τ tick their tasks; the frame stays orthonormal', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4b');
    const end = fig.locator('[data-readout="end"]');
    const before = await end.textContent();
    await fig.getByRole('slider', { name: /^סיבוב השלשה ההתחלתית/ }).fill('1');
    await expect(end).not.toHaveText(before!);
    await expect.poll(() => task(page, 'fig-2-4b:rotate')).toBeTruthy();
    await fig.getByRole('button', { name: 'τ ← −τ' }).click();
    await expect(fig.locator('[data-readout="law"]')).toContainText('τ ← −τ');
    await expect.poll(() => task(page, 'fig-2-4b:mirror')).toBeTruthy();
    // the integrated frame is orthonormal to rounding: the readout is a tiny power of ten
    await expect(fig.locator('[data-readout="ortho"] b')).toContainText('10');
  });

  test('on the glued curve the torsion is 0 on both sides, and crossing t = 0 ticks the jump task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4c');
    const slider = fig.getByRole('slider', { name: /^הפרמטר t/ });
    // grid of 600 on [−1.1, 1.1]: 450 is t = 0.55, 150 is t = −0.55
    await slider.fill('450');
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0');
    expect(await task(page, 'fig-2-4c:jump')).toBeFalsy();
    await slider.fill('150');
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0');
    await expect.poll(() => task(page, 'fig-2-4c:jump')).toBeTruthy();
  });

  test('a text step never ticks a task, even one that flattens, rotates or mirrors', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    for (const s of await page.locator('.step[data-fig="fig-2-4a"], .step[data-fig="fig-2-4b"], .step[data-fig="fig-2-4c"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-2-4a:helix', 'fig-2-4a:flat', 'fig-2-4a:same-kappa', 'fig-2-4b:rotate', 'fig-2-4b:mirror', 'fig-2-4c:jump']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.4-statement', 'Q-2.4-f', 'Q-2.4-f3', 'Q-2.4-proper', 'Q-2.4-param']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
