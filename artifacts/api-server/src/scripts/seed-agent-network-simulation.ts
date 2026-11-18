import { and, eq } from "drizzle-orm";
import {
  agentNetworkMatchesTable,
  agentNetworkRequirementsTable,
  branchesTable,
  businessAgenciesTable,
  db,
  pool,
  propertiesTable,
  usersTable,
} from "@workspace/db";
import {
  matchNetworkListings,
  type NetworkListing,
  type NetworkRequirement,
} from "../lib/agent-network-matching";

if (process.env.NODE_ENV !== "development" || process.env.ALLOW_AGENT_NETWORK_FIXTURES !== "true") {
  throw new Error(
    "Refusing to seed Agent Network demo records. Set NODE_ENV=development and ALLOW_AGENT_NETWORK_FIXTURES=true explicitly.",
  );
}

const agencySpecs = [
  { name: "Harare Homes Demo", branch: "Harare Homes Demo — Avondale" },
  { name: "Capital Property Demo", branch: "Capital Property Demo — Highlands" },
  { name: "Eastern Estates Demo", branch: "Eastern Estates Demo — Mutare" },
];
const agentSpecs = [
  { name: "Demo Agent A", email: "agent-a@agent-network.example", agency: 0 },
  { name: "Demo Agent B", email: "agent-b@agent-network.example", agency: 0 },
  { name: "Demo Agent C", email: "agent-c@agent-network.example", agency: 1 },
  { name: "Demo Agent D", email: "agent-d@agent-network.example", agency: 1 },
  { name: "Demo Agent E", email: "agent-e@agent-network.example", agency: 2 },
];
const suburbs = ["Avondale", "Borrowdale", "Highlands", "Greendale", "Mutare"];
const propertyTypes = ["house", "apartment", "townhouse", "stand", "commercial"];
const propertyFeatures = [
  ["Solar", "Borehole"],
  ["Garden", "Borehole"],
  ["Solar", "Garage"],
  ["Pool", "Solar"],
  ["Borehole", "Secure parking"],
];

try {
  const seedResult = await db.transaction(async (tx) => {
    const agencies = [];
    for (const spec of agencySpecs) {
      const [existing] = await tx.select().from(businessAgenciesTable)
        .where(eq(businessAgenciesTable.name, spec.name)).limit(1);
      if (existing) agencies.push(existing);
      else {
        const [created] = await tx.insert(businessAgenciesTable).values({
          name: spec.name,
          status: "active",
          aboutText: "DEMO ONLY — Agent Network matching simulation.",
        }).returning();
        agencies.push(created);
      }
    }

    const branches = [];
    for (let index = 0; index < agencySpecs.length; index += 1) {
      const [existing] = await tx.select().from(branchesTable).where(and(
        eq(branchesTable.agencyId, agencies[index].id),
        eq(branchesTable.name, agencySpecs[index].branch),
      )).limit(1);
      if (existing) branches.push(existing);
      else {
        const [created] = await tx.insert(branchesTable).values({
          agencyId: agencies[index].id,
          name: agencySpecs[index].branch,
          isMain: true,
          status: "active",
        }).returning();
        branches.push(created);
      }
    }

    const agents = [];
    for (const spec of agentSpecs) {
      const [agent] = await tx.insert(usersTable).values({
        name: spec.name,
        email: spec.email,
        role: "agent",
        branchId: branches[spec.agency].id,
        status: "active",
      }).onConflictDoUpdate({
        target: usersTable.email,
        set: { name: spec.name, role: "agent", branchId: branches[spec.agency].id, status: "active" },
      }).returning();
      agents.push(agent);
    }

    const properties = [];
    for (let index = 0; index < 15; index += 1) {
      const agentIndex = index % agents.length;
      const typeIndex = index % propertyTypes.length;
      const reference = `DEMO-AGENT-NETWORK-${String(index + 1).padStart(2, "0")}`;
      const values = {
        reference,
        title: `DEMO — Agent Network Listing ${String(index + 1).padStart(2, "0")}`,
        description: "DEMO ONLY — fictional property for testing private Agent Network matches.",
        propertyType: propertyTypes[typeIndex],
        listingType: "sale",
        status: "draft",
        pipelineStage: "draft",
        price: 120_000 + (index % 5) * 30_000,
        currency: "USD",
        suburb: suburbs[index % suburbs.length],
        city: "Harare",
        bedrooms: 2 + (index % 4),
        bathrooms: 1 + (index % 3),
        parking: index % 3,
        landSize: 400 + index * 25,
        features: propertyFeatures[index % propertyFeatures.length],
        photos: [] as string[],
        proposedViewingTimes: [] as string[],
        agentId: agents[agentIndex].id,
        branchId: branches[agentSpecs[agentIndex].agency].id,
        networkEnabled: true,
        availabilityStatus: "available",
      };
      const [existing] = await tx.select().from(propertiesTable)
        .where(eq(propertiesTable.reference, reference)).limit(1);
      if (existing && !existing.title.startsWith("DEMO — Agent Network Listing ")) {
        throw new Error(`Refusing to overwrite non-demo property ${reference}.`);
      }
      const [property] = await tx.insert(propertiesTable).values(values)
        .onConflictDoUpdate({
          target: propertiesTable.reference,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      properties.push(property);
    }

    const requirements = [];
    for (let index = 0; index < 10; index += 1) {
      const agentIndex = index % agents.length;
      const marker = `DEMO ONLY — Agent Network buyer requirement ${String(index + 1).padStart(2, "0")}.`;
      const values = {
        agentId: agents[agentIndex].id,
        branchId: branches[agentSpecs[agentIndex].agency].id,
        buyerName: `Demo Buyer ${String(index + 1).padStart(2, "0")}`,
        phone: null,
        email: null,
        requestText: marker,
        propertyType: propertyTypes[index % propertyTypes.length],
        listingType: "sale",
        budgetMin: 100_000,
        budgetMax: 300_000,
        currency: "USD",
        areas: [suburbs[index % suburbs.length], suburbs[(index + 1) % suburbs.length]],
        bedroomsMin: 2 + (index % 3),
        bedroomsMax: 5,
        requiredFeatures: index % 2 === 0 ? ["Borehole"] : [],
        preferredFeatures: ["Solar"],
        otherPreferences: [],
        status: "new",
      };
      const [existing] = await tx.select().from(agentNetworkRequirementsTable)
        .where(eq(agentNetworkRequirementsTable.requestText, marker)).limit(1);
      const [requirement] = existing
        ? await tx.update(agentNetworkRequirementsTable).set(values)
            .where(eq(agentNetworkRequirementsTable.id, existing.id)).returning()
        : await tx.insert(agentNetworkRequirementsTable).values(values).returning();
      requirements.push(requirement);
    }

    const networkListings = new Map<number, NetworkListing>(properties.map((property) => [
      property.id,
      {
        id: property.id,
        title: property.title,
        propertyType: property.propertyType,
        listingType: property.listingType,
        suburb: property.suburb,
        city: property.city,
        price: property.price,
        currency: property.currency,
        bedrooms: property.bedrooms,
        features: property.features,
        description: property.description,
      },
    ]));
    let matchCount = 0;
    for (const requirement of requirements) {
      const networkRequirement: NetworkRequirement = {
        id: requirement.id,
        propertyType: requirement.propertyType,
        listingType: requirement.listingType,
        areas: requirement.areas,
        budgetMin: requirement.budgetMin,
        budgetMax: requirement.budgetMax,
        bedroomsMin: requirement.bedroomsMin,
        bedroomsMax: requirement.bedroomsMax,
        requiredFeatures: requirement.requiredFeatures,
        preferredFeatures: requirement.preferredFeatures,
        otherPreferences: requirement.otherPreferences,
      };
      for (const match of matchNetworkListings(networkRequirement, [...networkListings.values()])) {
        const property = properties.find((candidate) => candidate.id === match.propertyId);
        if (!property?.agentId || property.agentId === requirement.agentId) continue;
        await tx.insert(agentNetworkMatchesTable).values({
          propertyId: match.propertyId,
          requirementId: requirement.id,
          listingAgentId: property.agentId,
          buyerAgentId: requirement.agentId,
          matchPercent: match.matchPercent,
          category: match.category,
          reasons: match.reasons,
          status: "open",
        }).onConflictDoUpdate({
          target: [agentNetworkMatchesTable.propertyId, agentNetworkMatchesTable.requirementId],
          set: {
            matchPercent: match.matchPercent,
            category: match.category,
            reasons: match.reasons,
            updatedAt: new Date(),
          },
        });
        matchCount += 1;
      }
    }
    return {
      agentCount: agents.length,
      agencyCount: agencies.length,
      propertyCount: properties.length,
      requirementCount: requirements.length,
      matchCount,
    };
  });
  console.log(`Seeded Agent Network simulation: ${JSON.stringify(seedResult)}. All records are clearly marked DEMO ONLY.`);
} finally {
  await pool.end();
}
