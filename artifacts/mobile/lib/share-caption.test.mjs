import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalogueWhatsAppCaption, buildPropertyFlyerCaption } from "../utils/shareContent.ts";
import { catalogueShareLinks } from "../utils/shareLinks.ts";

test("WhatsApp flyer caption links to the signed-in agent's public catalogue", () => {
  const agentId = "agent-123";
  const catalogueUrl = catalogueShareLinks(agentId).webUrl;

  assert.equal(
    buildPropertyFlyerCaption(agentId),
    `Click here to view my entire catalogue on ${catalogueUrl}`,
  );
  assert.equal(
    buildCatalogueWhatsAppCaption(agentId),
    `Click here to view my entire catalogue on ${catalogueUrl}`,
  );
});

test("company brochure caption uses the public QuickProp homepage when no agent is selected", () => {
  const catalogueUrl = catalogueShareLinks().webUrl;

  assert.equal(
    buildCatalogueWhatsAppCaption(),
    `Click here to view my entire catalogue on ${catalogueUrl}`,
  );
});
