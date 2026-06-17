const playwright = require("playwright-core");

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzZWVkLWFkbWluLXVzZXIiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwicHJlZmVycmVkTGFuZ3VhZ2UiOiJFTiIsImlhdCI6MTc4MTY2OTk5OSwiZXhwIjoxNzgxNzU2Mzk5fQ.dbOvBmEMv6moM8dN3zydcjVcJPReN1OWRkE7v9FCL_M";

(async () => {
  const executablePath = "C:\\Users\\LENOVO\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe";
  const browser = await playwright.chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000", { timeout: 15000 });
  await page.evaluate((token) => {
    localStorage.setItem("guesthouse_access_token", token);
  }, TOKEN);

  await page.goto("http://localhost:3000/reports", { timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "C:/temp/new_closed.png" });
  console.log("Saved new_closed.png");

  // Click the calendar icon button (date range sheet)
  try {
    const allBtns = await page.locator("button").all();
    let calendarClicked = false;
    for (const b of allBtns) {
      const html = await b.innerHTML().catch(() => "");
      if (html.toLowerCase().includes("calendar") && !html.toLowerCase().includes("sliders")) {
        const visible = await b.isVisible();
        if (visible) {
          await b.click({ timeout: 3000 });
          await page.waitForTimeout(900);
          calendarClicked = true;
          console.log("Clicked calendar button");
          break;
        }
      }
    }
    if (!calendarClicked) console.log("Calendar button not found");
  } catch(e) { console.log("click err:", e.message); }

  await page.screenshot({ path: "C:/temp/new_date_open.png" });
  console.log("Saved new_date_open.png");
  await browser.close();
})().catch(e => console.error("Fatal:", e.message));
