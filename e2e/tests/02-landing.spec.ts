import { expect, test, type Page } from "@playwright/test"

// Landing — public page. Image assets (logos, mascots, avatars, hero) are not yet
// in the repo, so no image-load assertions here.

function navbar(page: Page) {
  return page.locator("nav.fixed")
}

test.describe("Landing", () => {
  test("fires GET {API}/health on mount", async ({ page }) => {
    const health = page.waitForRequest((r) => r.method() === "GET" && r.url() === "http://localhost:8000/health")
    await page.goto("/landing")
    await health
  })

  test("unauthenticated / redirects to /landing", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL("/landing")
  })

  test("navbar links and blur after scrolling past 40px", async ({ page }) => {
    await page.goto("/landing")
    const nav = navbar(page)
    await expect(nav.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/sign-in")
    await expect(nav.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/sign-up")
    await expect(nav.getByRole("link", { name: "Log In" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeVisible()
    await expect(nav.locator('a[href="/landing"]')).toBeVisible()

    await expect(nav).toHaveClass(/bg-transparent/)
    await expect(nav).not.toHaveClass(/backdrop-blur-xl/)
    await page.evaluate(() => window.scrollTo(0, 200))
    await expect(nav).toHaveClass(/backdrop-blur-xl/)
    await expect(nav).toHaveClass(/bg-white\/80/)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(nav).toHaveClass(/bg-transparent/)

    await nav.getByRole("link", { name: "Sign Up" }).click()
    await expect(page).toHaveURL("/sign-up")
    await page.goto("/landing")
    await navbar(page).getByRole("link", { name: "Log In" }).click()
    await expect(page).toHaveURL("/sign-in")
  })

  test("hero copy and Start Your Journey → /sign-up", async ({ page }) => {
    await page.goto("/landing")
    await expect(page.getByText("Now in Open Beta")).toBeVisible()
    const h1 = page.getByRole("heading", { level: 1 })
    await expect(h1).toContainText("Your fears")
    await expect(h1).toContainText("are now ours.")
    const card = page.getByRole("heading", { level: 2, name: /Clinical Precision\./ })
    await expect(card).toContainText("Radical Clarity.")
    await expect(
      page.getByText("Replace subjective guesswork with AI-powered biometric tracking. The ultimate vault for your hair progression."),
    ).toBeVisible()
    // Phone mockup copy
    await expect(page.getByText("Progression", { exact: true })).toBeVisible()
    await expect(page.getByText("+12%")).toBeVisible()
    await expect(page.getByText("Minoxidil 5%")).toBeVisible()
    await expect(page.getByText("Biotin Complex")).toBeVisible()

    await page.getByRole("link", { name: "Start Your Journey" }).click()
    await expect(page).toHaveURL("/sign-up")
  })

  test("stats counters animate to final values when scrolled into view", async ({ page }) => {
    await page.goto("/landing")
    await page.getByText("Active Vaults").scrollIntoViewIfNeeded()
    await expect(page.getByText("48+", { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("1,260+", { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("6+", { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("Scans Analyzed")).toBeVisible()
    await expect(page.getByText("Partner Clinicians")).toBeVisible()
  })

  test("engine room: specialists and terminal typewriter", async ({ page }) => {
    await page.goto("/landing")
    await page.getByText("The Bedrock Engine").scrollIntoViewIfNeeded()
    await expect(page.getByRole("heading", { name: /Meet our two specialists/ })).toContainText(
      "that will help you through your journey.",
    )
    await expect(page.getByText("Powered by Amazon Bedrock (Claude Sonnet 5.5 + Nova Lite).")).toBeVisible()

    await expect(page.getByRole("heading", { name: "Dr. Claude" })).toBeVisible()
    await expect(page.getByText("The Clinical Pathologist")).toBeVisible()
    await expect(
      page.getByText(
        "I am here for you to help you analyze your unstructured medical reports to extract DHT, ferritin, and 40+ complex biomarkers with deep reasoning.",
      ),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Dr. Nova" })).toBeVisible()
    await expect(page.getByText("The Chief Trichologist")).toBeVisible()
    await expect(
      page.getByText(
        "I am here for you to help you visually scan your scalp photos in milliseconds to quantify individual follicular units with robotic accuracy.",
      ),
    ).toBeVisible()
    for (const chip of ["Pathology", "Lab Data", "Computer Vision", "Speed"]) {
      await expect(page.getByText(chip, { exact: true })).toBeVisible()
    }
    await expect(page.getByText("Secured by end-to-end encrypted medical vault")).toBeVisible()

    await page.getByText("densify-core-engine").scrollIntoViewIfNeeded()
    const terminal = page.locator("div.font-mono.h-\\[250px\\]")
    await expect(terminal).toContainText("> Analyzing follicular array...", { timeout: 5_000 })
    await expect(terminal).toContainText("> Process complete. Data appended to vault.", { timeout: 10_000 })
    await expect(terminal).toContainText("> Vertex density: 159.4 hairs/cm²")
    await expect(terminal).toContainText("> Confidence score: 0.97")
  })

  test("Wall of Proof testimonials, final CTA and footer", async ({ page }) => {
    await page.goto("/landing")
    const wall = page.getByRole("heading", { name: "The Wall of Proof." })
    await wall.scrollIntoViewIfNeeded()
    await expect(wall).toBeVisible()
    await expect(page.getByText("Don't just take our word for it.")).toBeVisible()
    const names = ["James R.", "Dr. Priya Mehta", "Marcus T.", "Alex W.", "Dr. S. K."]
    for (const n of names) {
      await expect(page.getByText(n, { exact: true })).toBeAttached()
    }
    await expect(page.locator("div.break-inside-avoid")).toHaveCount(5)
    await expect(page.getByText("Board-Certified Trichologist")).toBeAttached()
    await expect(page.getByText(/Stopped guessing, started measuring\./)).toBeAttached()

    const cta = page.getByRole("heading", { name: "Ready for clarity?" })
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    await expect(page.getByText("Join thousands tracking with clinical precision.")).toBeVisible()

    const footer = page.locator("footer")
    for (const l of ["Privacy", "Terms", "Security"]) {
      await expect(footer.getByRole("link", { name: l })).toHaveAttribute("href", "#")
    }

    await page.getByRole("link", { name: "Create Your Free Vault" }).click()
    await expect(page).toHaveURL("/sign-up")
  })
})

test.describe("Landing — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("hamburger toggles the mobile menu panel", async ({ page }) => {
    await page.goto("/landing")
    const nav = navbar(page)
    // md+ links are hidden at this width.
    await expect(nav.getByRole("link", { name: "Log In" })).toBeHidden()
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeHidden()

    const burger = nav.locator("button.md\\:hidden")
    await expect(burger).toBeVisible()
    await burger.click()
    const panel = nav.locator("div.md\\:hidden")
    await expect(panel).toBeVisible()
    await expect(panel.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/sign-in")
    await expect(panel.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/sign-up")
    await expect(panel.getByRole("link", { name: "Log In" })).toBeVisible()
    await expect(panel.getByRole("link", { name: "Sign Up" })).toBeVisible()

    await burger.click()
    await expect(panel).toHaveCount(0)

    await burger.click()
    await panel.getByRole("link", { name: "Sign Up" }).click()
    await expect(page).toHaveURL("/sign-up")
  })
})
