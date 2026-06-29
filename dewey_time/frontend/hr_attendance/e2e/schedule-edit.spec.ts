import { test, expect } from "@playwright/test";

import { stubFrappe } from "./fixtures";

test.describe("schedule edit", () => {
  test("editing an existing schedule shows the reconcile review", async ({ page }) => {
    await stubFrappe(page);
    await page.goto("/hr-schedule?employee=EMP-001");

    // Save reads "Review changes" for an employee with an existing schedule.
    const save = page.getByRole("button", { name: /Review changes|Save schedule/ });
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
    await save.click();

    // The confirm dialog surfaces the "what changes on E" reconcile section.
    await expect(page.getByText(/Retiring MON-FRI 09–17/)).toBeVisible();
    await expect(page.getByText(/Adding MON-SAT 09–17 from 2026-07-01/)).toBeVisible();
    await expect(page.getByText(/1 future shift inactivated/)).toBeVisible();
    await expect(page.getByText(/1 shift trimmed to end 2026-06-30/)).toBeVisible();
  });
});
