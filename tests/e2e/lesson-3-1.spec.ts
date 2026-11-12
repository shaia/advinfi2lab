import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-1/';

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

test.describe('lesson 3.1: a smooth parametrized surface', () => {
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

  test('the sphere: ‖σu × σv‖ = cos v, and moving to the pole ticks the pole task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    // initial v snaps to −π/2 + π·158/240 ≈ 0.4974, and cos 0.4974 ≈ 0.879
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('0.879');
    expect(await task(page, 'fig-3-1a:pole')).toBeFalsy();
    // v = π/2 at the end of the slider: the north pole, where σu = 0
    await fig.getByRole('slider', { name: /^הפרמטר v/ }).fill('240');
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('לא רגולרית');
    await expect.poll(() => task(page, 'fig-3-1a:pole')).toBeTruthy();
  });

  test('the double cone: choosing it does not tick, reaching the vertex does', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    await fig.getByRole('button', { name: 'חרוט כפול' }).click();
    // choosing the cone puts the point at v = 0, the vertex, but that is not the reader's move
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('לא רגולרית');
    expect(await task(page, 'fig-3-1a:vertex')).toBeFalsy();
    const slider = fig.getByRole('slider', { name: /^הפרמטר v/ });
    await slider.fill('180');
    // v = −1.2 + 2.4·180/240 = 0.6: ‖σu × σv‖ = √2 · 0.6 ≈ 0.849
    await expect(fig.locator('[data-readout="regularity"]')).toContainText('0.849');
    await slider.fill('120');
    await expect.poll(() => task(page, 'fig-3-1a:vertex')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    // walks every step of the page: slow on a loaded machine
    test.slow();
    await page.goto(LESSON);
    // steps put the sphere near the pole, the cone near the vertex and the hemisphere graph at the pole
    for (const s of await page.locator('.step[data-fig="fig-3-1a"], .step[data-fig="fig-3-1b"]').all()) {
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-3-1a:pole', 'fig-3-1a:vertex', 'fig-3-1a:torus-inner', 'fig-3-1b:pole', 'fig-3-1b:polar-origin', 'fig-3-1b:vertex']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.1-regular-def', 'Q-3.1-sphere-singular', 'Q-3.1-rev-regular', 'Q-3.1-pole', 'Q-3.1-parallel']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
