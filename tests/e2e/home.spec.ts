import { expect, test } from '@playwright/test';
import { chapters } from '../../src/course';

test.describe('the home page', () => {
  test('lists every chapter and lesson of the course map, in Hebrew RTL', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText('אינפי מתקדם 2');
    await expect(page.locator('.chapters > li.chapter')).toHaveCount(chapters.length);
    await expect(page.locator('[data-lesson-id]')).toHaveCount(chapters.flatMap((c) => c.lessons).length);
    await expect(page.locator('.chapter').filter({ hasText: 'מעבר לסילבוס' })).toHaveCount(chapters.filter((c) => c.beyondSyllabus).length);
  });

  test('the cover: the osculating circle passes through the point, has radius 1/κ and its centre on the normal side', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('svg.cover-art');
    await expect(svg).toBeVisible();
    const r = await svg.evaluate((el) => {
      const osc = el.querySelector<SVGCircleElement>('circle.osc')!;
      const pt = el.querySelector<SVGCircleElement>('circle.point')!;
      return {
        kappa: Number(el.getAttribute('data-kappa')),
        scale: Number(el.getAttribute('data-scale')),
        r: osc.r.baseVal.value,
        cx: osc.cx.baseVal.value,
        cy: osc.cy.baseVal.value,
        px: pt.cx.baseVal.value,
        py: pt.cy.baseVal.value,
        x: Number(pt.dataset.x),
        y: Number(pt.dataset.y),
      };
    });
    // the ellipse (2 cos t, sin t) at t = 0.25: κ = 2 / (4 sin² t + cos² t)^{3/2}
    const t = 0.25;
    expect(Math.abs(r.kappa - 2 / (4 * Math.sin(t) ** 2 + Math.cos(t) ** 2) ** 1.5)).toBeLessThan(1e-8);
    expect(Math.abs(r.x / 2 - Math.cos(t)) + Math.abs(r.y - Math.sin(t))).toBeLessThan(1e-12);
    expect(Math.abs(r.r - r.scale / r.kappa)).toBeLessThan(0.01);
    expect(Math.abs(Math.hypot(r.px - r.cx, r.py - r.cy) - r.r)).toBeLessThan(0.05);
    // the ellipse bends toward its centre: the circle's centre is closer to the origin's side than the point
    expect(Math.hypot(r.cx - 320, r.cy - 210)).toBeLessThan(Math.hypot(r.px - 320, r.py - 210));
  });

  test('no sideways scroll', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
