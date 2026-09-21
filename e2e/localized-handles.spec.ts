import { createTestPage, db, testDataPrefix } from "./support/factories";
import { expect, test } from "./support/fixtures";

test("redirects source and previous Portuguese handles while English remains canonical", async ({ page, runId }) => {
  const record = await createTestPage(runId, { status: "PUBLISHED", visibility: "PUBLIC", content: { body: "Body" } });
  const firstHandle = `${testDataPrefix(runId)}-diario`;
  const nextHandle = `${testDataPrefix(runId)}-caderno`;
  const translation = await db.pageTranslation.create({
    data: { pageId: record.id, locale: "pt", title: "Diário", localizedHandle: firstHandle },
  });

  await page.goto(`/pt/${record.slug}`);
  await expect(page).toHaveURL(new RegExp(`/pt/${firstHandle}$`));

  await db.$transaction([
    db.pageTranslation.update({ where: { id: translation.id }, data: { localizedHandle: nextHandle } }),
    db.localizedHandleRedirect.create({
      data: { entityType: "PAGE", entityId: record.id, locale: "pt", fromHandle: firstHandle, toHandle: nextHandle },
    }),
  ]);
  await page.goto(`/pt/${firstHandle}`);
  await expect(page).toHaveURL(new RegExp(`/pt/${nextHandle}$`));

  await page.goto(`/en/${record.slug}`);
  await expect(page).toHaveURL(new RegExp(`/en/${record.slug}$`));
});
