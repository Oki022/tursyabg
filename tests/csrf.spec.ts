import { expect, test } from "@playwright/test";

// Регресионен тест за CSRF. Старата ръчна проверка разпознаваше server
// function по заглавката x-tsr-serverFn, която изпращачът контролира: ако я
// пропусне, проверката се прескачаше. Сега TanStack разпознава server
// function по адреса, затова чужда заявка без заглавката също е отхвърлена.
const SERVER_FN = "/_serverFn/csrf-probe";

test.describe("CSRF", () => {
  test("заявка от чужд сайт без x-tsr-serverFn е отхвърлена", async ({ request }) => {
    const res = await request.post(SERVER_FN, {
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      data: {},
    });
    expect(res.status()).toBe(403);
  });

  test("заявка без Origin, Sec-Fetch-Site и Referer е отхвърлена", async ({ request }) => {
    const res = await request.post(SERVER_FN, {
      headers: { "content-type": "application/json" },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});