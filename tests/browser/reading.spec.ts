import { expect, test } from '@playwright/test';
import path from 'node:path';

/**
 * Browser-level happy path that the HTTP e2e script cannot cover:
 * real clicks, scroll-driven progress and the dictionary popup.
 */
test('注册 → 上传 → 预习 → 单击查词 → 续读进度', async ({ page }) => {
  const email = `pw-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.fill('#email', email);
  await page.fill('#password', 'Passw0rd!2024');
  await page.getByRole('button', { name: /注册并进入书库/ }).click();
  await expect(page).toHaveURL(/\/library$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '我的书库' })).toBeVisible();

  // Upload the bundled sample PDF through the real file input.
  await page.setInputFiles('input[type=file]', path.join(process.cwd(), 'samples', 'sample-book.pdf'));
  await page.getByRole('button', { name: /上传并解析/ }).click();

  const bookCard = page.locator('a.book-card').first();
  await expect(bookCard).toBeVisible({ timeout: 60_000 });
  await bookCard.click();

  await expect(page.getByText('Chapter One').first()).toBeVisible();
  await page.getByRole('link', { name: '开始预习' }).first().click();

  await expect(page.getByRole('heading', { name: /长难句精讲/ })).toBeVisible({ timeout: 240_000 });
  await page.getByRole('button', { name: /完成预习，开始阅读/ }).click();

  await expect(page.locator('article.reader-article')).toBeVisible({ timeout: 60_000 });

  // Kindle-style lookup: clicking a highlighted word must open the dictionary card.
  const hardWord = page.locator('.hard-word').first();
  if (await hardWord.count()) {
    await hardWord.click();
  } else {
    await page.locator('p[data-p="1"]').click();
  }
  await expect(page.locator('.popup')).toBeVisible();
  await expect(page.locator('.popup-quote')).not.toBeEmpty();

  // Scroll to the end and let the throttled progress report fire.
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(3200);

  const bookPath = new URL(page.url()).pathname.split('/read/')[0];
  await page.goto(bookPath);
  await expect(page.getByText(/已读\s*\d+%/).first()).toBeVisible({ timeout: 15_000 });
});
