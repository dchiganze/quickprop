/**
 * Explicitly requested, clearly labelled public sharing fixture.
 * Uses the normal signed publication API, not a production database connection.
 * Owner details must be supplied from a verified, active agent account.
 */
import { readFile } from "node:fs/promises";
import { pool } from "../lib/db/src/index";
import { sendPropertyPublication } from "../artifacts/api-server/src/lib/publication-sync";

const owner = JSON.parse(await readFile(".local/douglas-sharing-demo-owner.json", "utf8")) as {
  id: number; name: string; email: string; branchName: string;
};
if (owner.id !== 2535 || owner.name.toLowerCase() !== "douglas chiganze" || !owner.email || !owner.branchName) {
  throw new Error("A verified Douglas Chiganze agent account is required.");
}
const now = new Date();
try {
  await sendPropertyPublication({
    isPublic: true,
    agent: { name: owner.name, email: owner.email },
    branch: { name: owner.branchName },
    seller: null,
    property: {
      reference: "DEMO-SHARE-DOUGLAS",
      title: "DEMO — Sharing Test — 3 Bedroom Home",
      description: "DEMO LISTING — NOT A REAL PROPERTY FOR SALE. Created at the owner's request solely to test QuickProp sharing to Facebook, LinkedIn and other apps. Stock photographs are illustrative and do not represent a property marketed by Douglas Chiganze or his agency. Please do not enquire or arrange a viewing.",
      propertyType: "house", listingType: "sale", status: "public", pipelineStage: "listed",
      price: 275000, currency: "USD", negotiable: false,
      suburb: "Avondale", city: "Harare", address: null, addressVisible: false,
      bedrooms: 3, bathrooms: 2, parking: 2, landSize: 1000,
      features: ["DEMO ONLY — Not a real property", "Sharing test"],
      photos: [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=85",
      ],
      proposedViewingTimes: [], hasBrochure: false, collaborationEnabled: false,
      availabilityStatus: "available", publishedAt: now, createdAt: now, updatedAt: now,
    },
  });
  console.log("Created public DEMO-SHARE-DOUGLAS using the signed publication API.");
} finally {
  await pool.end();
}
