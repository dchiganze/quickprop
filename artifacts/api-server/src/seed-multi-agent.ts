import { and, eq } from "drizzle-orm";
import {
  branchesTable,
  db,
  propertiesTable,
  propertyAgentRelationshipsTable,
  propertyDuplicateReviewsTable,
  propertyMarketingAssetsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "./lib/passwords";

const demoPhoto = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85";

async function findOrCreateBranch(name: string) {
  const [existing] = await db.select().from(branchesTable).where(eq(branchesTable.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(branchesTable).values({ name, address: "Borrowdale, Harare" }).returning();
  return created;
}

async function findOrCreateAgent(
  name: string,
  email: string,
  phone: string,
  branchId: number,
  password: string,
) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(usersTable).values({
    name,
    email,
    phone,
    branchId,
    role: "agent",
    password,
  }).returning();
  return created;
}

async function findOrCreateProperty(
  reference: string,
  values: Omit<typeof propertiesTable.$inferInsert, "reference">,
) {
  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.reference, reference)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(propertiesTable).values({ reference, ...values }).returning();
  return created;
}

async function seedMultiAgentDemo() {
  const password = await hashPassword("demo1234");
  const agencySeeds = [
    ["QuickProp Borrowdale", "Tariro Muchengeti", "tariro.multi@quickprop.demo", "+263 77 410 0001", 485000],
    ["Pam Golding Zimbabwe", "Rudo Nyamutswa", "rudo@pamgolding.demo", "+263 77 410 0002", 475000],
    ["Seeff Zimbabwe", "Farai Chirenje", "farai@seeff.demo", "+263 77 410 0003", 490000],
  ] as const;

  const agencies = [];
  for (const [branchName, agentName, email, phone, price] of agencySeeds) {
    const branch = await findOrCreateBranch(branchName);
    const agent = await findOrCreateAgent(agentName, email, phone, branch.id, password);
    agencies.push({ branch, agent, price });
  }

  const canonical = await findOrCreateProperty("QP-MA-0001", {
    title: "Borrowdale Brooke Golf Estate Residence",
    description: "A refined four-bedroom residence in Borrowdale Brooke with golf-course views, solar backup, borehole and landscaped gardens.",
    propertyType: "house",
    listingType: "sale",
    status: "public",
    pipelineStage: "published",
    price: 475000,
    currency: "USD",
    suburb: "Borrowdale Brooke",
    city: "Harare",
    address: "18 Fairway Drive",
    normalizedAddress: "18 fairway drive borrowdale brooke harare",
    latitude: -17.7349,
    longitude: 31.1165,
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    landSize: 2100,
    features: ["golf estate", "solar", "borehole", "pool", "staff quarters"],
    photos: [demoPhoto],
    coverImage: demoPhoto,
    agentId: agencies[1].agent.id,
    branchId: agencies[1].branch.id,
    mandateType: "open",
    duplicateStatus: "clear",
    collaborationEnabled: true,
    lastAvailabilityConfirmedAt: new Date(),
    lastPriceConfirmedAt: new Date(),
    publishedAt: new Date(),
  });

  for (const [index, agency] of agencies.entries()) {
    const [existingRelationship] = await db
      .select()
      .from(propertyAgentRelationshipsTable)
      .where(and(
        eq(propertyAgentRelationshipsTable.propertyId, canonical.id),
        eq(propertyAgentRelationshipsTable.agentId, agency.agent.id),
        eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
      ))
      .limit(1);
    const relationship = existingRelationship ?? (await db.insert(propertyAgentRelationshipsTable).values({
      propertyId: canonical.id,
      agentId: agency.agent.id,
      branchId: agency.branch.id,
      mandateType: index === 1 ? "exclusive" : "open",
      relationshipStatus: "active",
      verificationStatus: "verified",
      askingPrice: agency.price,
      currency: "USD",
      terms: index === 0 ? "Negotiable, subject to seller approval" : index === 1 ? "Viewing by appointment" : "Offers invited",
      description: index === 0
        ? "Family-focused presentation with emphasis on the garden and entertainment spaces."
        : index === 1
          ? "Premium estate positioning with detailed golf-course and security features."
          : "Investment-focused presentation highlighting solar resilience and rental potential.",
      contactName: agency.agent.name,
      contactPhone: agency.agent.phone,
      contactEmail: agency.agent.email,
      lastAvailabilityConfirmation: new Date(),
      collaborationInformation: "Agency owns its offer, contact details, terms, description and media attribution.",
    }).returning())[0];

    const [existingAsset] = await db
      .select()
      .from(propertyMarketingAssetsTable)
      .where(and(
        eq(propertyMarketingAssetsTable.propertyId, canonical.id),
        eq(propertyMarketingAssetsTable.relationshipId, relationship.id),
      ))
      .limit(1);
    if (!existingAsset) {
      await db.insert(propertyMarketingAssetsTable).values({
        propertyId: canonical.id,
        relationshipId: relationship.id,
        assetType: "photo",
        objectPath: demoPhoto,
        attributionName: `${agency.branch.name} · ${agency.agent.name}`,
        uploadedBy: agency.agent.id,
      });
    }
  }

  const possibleDuplicate = await findOrCreateProperty("QP-MA-REVIEW", {
    title: "Four Bedroom Home in Borrowdale Brooke",
    description: "Four bedroom golf-estate home with pool, borehole and solar.",
    propertyType: "house",
    listingType: "sale",
    status: "draft",
    pipelineStage: "draft",
    price: 488000,
    currency: "USD",
    suburb: "Borrowdale Brooke",
    city: "Harare",
    address: "18 Fairway Dr",
    normalizedAddress: "18 fairway drive borrowdale brooke harare",
    latitude: -17.73492,
    longitude: 31.11648,
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    landSize: 2100,
    features: ["solar", "borehole", "pool"],
    photos: [demoPhoto],
    coverImage: demoPhoto,
    agentId: agencies[2].agent.id,
    branchId: agencies[2].branch.id,
    mandateType: "open",
    duplicateStatus: "potential_duplicate",
  });

  const [existingReview] = await db
    .select()
    .from(propertyDuplicateReviewsTable)
    .where(and(
      eq(propertyDuplicateReviewsTable.sourcePropertyId, possibleDuplicate.id),
      eq(propertyDuplicateReviewsTable.candidatePropertyId, canonical.id),
      eq(propertyDuplicateReviewsTable.status, "pending"),
    ))
    .limit(1);
  if (!existingReview) {
    await db.insert(propertyDuplicateReviewsTable).values({
      sourcePropertyId: possibleDuplicate.id,
      candidatePropertyId: canonical.id,
      confidenceScore: 96,
      matchingFields: ["normalizedAddress", "coordinates", "propertyType", "bedrooms", "bathrooms", "landSize", "photoFilename"],
      imageMatches: [demoPhoto],
      notes: "Seeded review example for the Borrowdale Brooke multi-agent property.",
    });
  }

  console.info(`Multi-agent demo ready: canonical property ${canonical.reference} (${canonical.id}) with ${agencies.length} agency offers.`);
}

seedMultiAgentDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });