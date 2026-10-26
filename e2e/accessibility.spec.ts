import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function analyze(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.slice(0, 6).map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));
  test.info().attach(`axe-${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  expect(summary, `Accessibility violations on ${label}`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `Horizontal overflow on ${label}`).toBeLessThanOrEqual(1);
}

test("key desktop screens have no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A mystery that keeps its receipts/ }),
  ).toBeVisible();
  await analyze(page, "landing-desktop");

  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "Create a Mystery" }),
  ).toBeVisible();
  await analyze(page, "create-desktop");

  await page.goto("/");
  await page.getByRole("button", { name: "Play the sample case" }).first().click();
  await expect(
    page.getByRole("heading", { name: "The Meridian at Midnight" }),
  ).toBeVisible();
  await analyze(page, "investigation-desktop");

  await page.getByRole("button", { name: "Review and accuse" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await analyze(page, "accusation-dialog-desktop");
  await dialog.getByRole("radio", { name: /Jonah Reed/ }).check();
  await dialog.getByRole("button", { name: "Submit final accusation" }).click();
  await expect(
    page.getByRole("heading", { name: "The evidence holds." }),
  ).toBeVisible();
  await analyze(page, "results-desktop");
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("key mobile screens stay readable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /A mystery that keeps its receipts/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "landing-mobile");
    await analyze(page, "landing-mobile");

    await page.goto("/create");
    await expect(
      page.getByRole("heading", { name: "Create a Mystery" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "create-mobile");
    await analyze(page, "create-mobile");

    await page.goto("/");
    await page.getByRole("button", { name: "Play the sample case" }).first().click();
    await expect(
      page.getByRole("heading", { name: "The Meridian at Midnight" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "investigation-mobile");
    await analyze(page, "investigation-mobile");

    await page.getByRole("button", { name: "Review and accuse" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoHorizontalOverflow(page, "accusation-dialog-mobile");
    await analyze(page, "accusation-dialog-mobile");
    await dialog.getByRole("radio", { name: /Jonah Reed/ }).check();
    await dialog.getByRole("button", { name: "Submit final accusation" }).click();
    await expect(
      page.getByRole("heading", { name: "The evidence holds." }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "results-mobile");
    await analyze(page, "results-mobile");
  });
});
