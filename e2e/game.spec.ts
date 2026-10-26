import { expect, test, type Page } from "@playwright/test";

const CUSTOM_SCENARIO =
  "A signed first edition vanishes from a locked rare-books room during a private reading. Three collectors were inside; one had already tried to buy it twice.";

const FORBIDDEN_SOLUTION_KEYS = [
  '"culpritSuspectId"',
  '"canonicalTimeline"',
  '"supportingEvidenceIds"',
  '"hintTexts"',
  '"validationStatus"',
  '"explanation"',
];

function caseIdFromUrl(page: Page): string {
  const match = /\/case\/([a-f0-9]{24})/.exec(page.url());
  if (!match?.[1]) {
    throw new Error(`The page is not in a case room: ${page.url()}`);
  }
  return match[1];
}

test.describe("sample investigation", () => {
  test("plays the complete sample and reveals the solution only after the accusation", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /A mystery that keeps its receipts/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Play the sample case" }).first().click();
    await expect(page).toHaveURL(/\/case\/[a-f0-9]{24}$/);
    await expect(
      page.getByRole("heading", { name: "The Meridian at Midnight" }),
    ).toBeVisible();
    await expect(page.getByText("Sample file")).toBeVisible();

    const caseId = caseIdFromUrl(page);
    const publicCase = await page.evaluate(async (id) => {
      const response = await fetch(`/api/cases/${id}`);
      return {
        status: response.status,
        body: await response.json(),
      };
    }, caseId);
    expect(publicCase.status).toBe(200);
    expect(publicCase.body.data.id).toBe(caseId);

    const serializedCase = JSON.stringify(publicCase.body);
    for (const key of FORBIDDEN_SOLUTION_KEYS) {
      expect(serializedCase).not.toContain(key);
    }
    await expect(page.getByText("Canonical culprit")).toHaveCount(0);

    const exhibits = page.getByRole("list", { name: "Evidence exhibits" });
    await expect(exhibits.getByRole("button")).toHaveCount(8);
    await exhibits.getByRole("button").first().click();
    await expect(
      page.locator("#evidence-detail").getByRole("heading", { level: 3 }),
    ).toBeVisible();
    await expect(page.getByText("Reviewed").first()).toBeVisible();

    await page.getByRole("button", { name: /Request hint \(3 left\)/ }).click();
    await expect(page.getByText("Hint 1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Request hint \(2 left\)/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Review and accuse" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Name the culprit" })).toBeVisible();
    await dialog.getByRole("radio", { name: /Jonah Reed/ }).check();
    await dialog.getByRole("button", { name: "Submit final accusation" }).click();

    await expect(
      page.getByRole("heading", { name: "The evidence holds." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "The solution" })).toBeVisible();
    await expect(page.getByText("Canonical culprit").first()).toBeVisible();
    await expect(page.getByText("Supporting evidence")).toBeVisible();
    await expect(page.getByText("Jonah Reed").first()).toBeVisible();
    await expect(page.getByText("90", { exact: true }).first()).toBeVisible();
  });

  test("scores an incorrect accusation at zero and still reveals the solution", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play the sample case" }).first().click();
    await expect(
      page.getByRole("heading", { name: "The Meridian at Midnight" }),
    ).toBeVisible();
    await expect(page.getByText("Canonical culprit")).toHaveCount(0);

    await page.getByRole("button", { name: "Review and accuse" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /Felix Dorn/ }).check();
    await dialog.getByRole("button", { name: "Submit final accusation" }).click();

    await expect(
      page.getByRole("heading", { name: "The file points elsewhere." }),
    ).toBeVisible();
    await expect(page.getByText("Accusation incorrect")).toBeVisible();
    await expect(page.getByText("Felix Dorn").first()).toBeVisible();
    await expect(page.getByText("Jonah Reed").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "The solution" })).toBeVisible();

    const scorePanel = page.locator("aside").filter({ hasText: "Score" }).first();
    await expect(scorePanel.getByText("0", { exact: true }).first()).toBeVisible();
  });

  test("creates a custom case and opens the validated investigation room", async ({
    page,
  }) => {
    await page.goto("/create");
    await expect(
      page.getByRole("heading", { name: "Create a Mystery" }),
    ).toBeVisible();

    await page.getByLabel("Scenario").fill(CUSTOM_SCENARIO);
    await page.getByLabel("Category").selectOption("fraud");
    await page
      .getByRole("group", { name: "Difficulty" })
      .getByText("Hard", { exact: true })
      .click();
    await expect(page.getByRole("radio", { name: "Hard" })).toBeChecked();
    await page.getByText("Chat transcript", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Chat transcript" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Create the case" }).click();

    await expect(page).toHaveURL(/\/case\/[a-f0-9]{24}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Suspects" })).toBeVisible();
    await expect(page.getByText("Sample file")).toHaveCount(0);
    await expect(page.getByText("Fraud")).toBeVisible();
    await expect(page.getByText("Hard", { exact: true })).toBeVisible();

    const caseId = caseIdFromUrl(page);
    const publicCase = await page.evaluate(async (id) => {
      const response = await fetch(`/api/cases/${id}`);
      return response.json();
    }, caseId);
    expect(publicCase.data).toMatchObject({
      id: caseId,
      category: "fraud",
      difficulty: "hard",
      isSample: false,
      status: "ready",
    });
    const serializedCase = JSON.stringify(publicCase);
    for (const key of FORBIDDEN_SOLUTION_KEYS) {
      expect(serializedCase).not.toContain(key);
    }
  });
});

test.describe("custom generation failure states", () => {
  test("shows progress, reports a failed file, and retries with a fresh key", async ({
    page,
  }) => {
    const generationId = "a".repeat(24);
    const caseId = "b".repeat(24);
    const pending = {
      id: generationId,
      caseId,
      status: "pending",
      stage: "drafting_blueprint",
      provider: "mock",
      message: "Drafting the suspects and exhibits.",
      createdAt: new Date(0).toISOString(),
    };
    const failed = {
      ...pending,
      status: "failed",
      stage: "failed",
      errorCode: "INVALID_AI_OUTPUT",
      message:
        "The generated case did not pass structural validation. Please try again.",
      completedAt: new Date(1_000).toISOString(),
    };

    let generationReads = 0;
    const idempotencyKeys: string[] = [];

    await page.route("**/api/cases", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const key = route.request().headers()["idempotency-key"];
      if (key) {
        idempotencyKeys.push(key);
      }
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ data: pending }),
      });
    });

    await page.route("**/api/generation/**", async (route) => {
      generationReads += 1;
      const body = generationReads === 2 ? failed : pending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: body }),
      });
    });

    await page.goto("/create");
    await page.getByLabel("Scenario").fill(CUSTOM_SCENARIO);
    await page.getByRole("button", { name: "Create the case" }).click();

    await expect(
      page.getByRole("heading", { name: "Building the case file" }),
    ).toBeVisible();
    await expect(page.getByText("Drafting the suspects and exhibits.")).toBeVisible();
    await expect(
      page.getByText("No percentage is shown because the server reports stages"),
    ).toBeVisible();
    await expect(page.getByLabel("Scenario")).toBeDisabled();
    expect(idempotencyKeys).toHaveLength(1);

    await expect(
      page.getByRole("heading", { name: "The case was not published" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Output rejected by validation")).toBeVisible();
    await expect(
      page.getByText(/did not pass structural validation/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Try this brief again" }).click();
    await expect(
      page.getByRole("heading", { name: "Building the case file" }),
    ).toBeVisible();

    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[0]).toMatch(/^case-/);
    expect(idempotencyKeys[1]).toMatch(/^case-/);
    expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
    await expect(page.getByLabel("Scenario")).toBeDisabled();
  });
});
