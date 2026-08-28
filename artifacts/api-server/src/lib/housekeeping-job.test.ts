import assert from "node:assert/strict";
import { test } from "node:test";
import { and, asc, eq, inArray } from "drizzle-orm";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "re-running a housekeeping day is idempotent and relationship scoped",
  {
    skip: testDatabaseUrl
      ? false
      : "requires an isolated database configured through TEST_DATABASE_URL",
  },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const database = await import("@workspace/db");
    const { runHousekeepingCycle } = await import("./housekeeping-job");
    const {
      db,
      listingHousekeepingEventsTable,
      listingHousekeepingPreferencesTable,
      notificationsTable,
      propertiesTable,
      propertyAgentRelationshipsTable,
      tasksTable,
      usersTable,
    } = database;
    const fixture: {
      userIds: number[];
      propertyId?: number;
      relationshipIds: number[];
    } = {
      userIds: [],
      relationshipIds: [],
    };

    try {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [agentOne, agentTwo] = await db.insert(usersTable).values([
        {
          name: `Housekeeping test agent one ${suffix}`,
          email: `housekeeping-one-${suffix}@example.test`,
          role: "agent",
        },
        {
          name: `Housekeeping test agent two ${suffix}`,
          email: `housekeeping-two-${suffix}@example.test`,
          role: "agent",
        },
      ]).returning({ id: usersTable.id });
      assert.ok(agentOne && agentTwo);
      fixture.userIds = [agentOne.id, agentTwo.id];

      const now = new Date();
      const [property] = await db.insert(propertiesTable).values({
        reference: `HOUSEKEEPING-${suffix}`,
        title: "Housekeeping idempotency fixture",
        description: "Fixture for listing freshness transitions",
        propertyType: "house",
        status: "public",
        pipelineStage: "published",
        price: 250000,
        suburb: "Avondale",
        agentId: agentOne.id,
        availabilityStatus: "available",
        freshnessStatus: "fresh",
        nextConfirmationAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      }).returning({ id: propertiesTable.id });
      assert.ok(property);
      fixture.propertyId = property.id;

      const [relationshipOne, relationshipTwo] = await db
        .insert(propertyAgentRelationshipsTable)
        .values([
          {
            propertyId: property.id,
            agentId: agentOne.id,
            askingPrice: 250000,
            relationshipStatus: "active",
            availabilityStatus: "available",
            freshnessStatus: "fresh",
            lastAvailabilityConfirmation: new Date(
              now.getTime() - 60 * 24 * 60 * 60 * 1000,
            ),
            nextConfirmationAt: new Date(
              now.getTime() - 35 * 24 * 60 * 60 * 1000,
            ),
            createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            lastUpdate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          },
          {
            propertyId: property.id,
            agentId: agentTwo.id,
            askingPrice: 250000,
            relationshipStatus: "active",
            availabilityStatus: "available",
            freshnessStatus: "fresh",
            lastAvailabilityConfirmation: new Date(
              now.getTime() - 2 * 24 * 60 * 60 * 1000,
            ),
            nextConfirmationAt: new Date(
              now.getTime() + 10 * 24 * 60 * 60 * 1000,
            ),
            createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            lastUpdate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        ])
        .returning({ id: propertyAgentRelationshipsTable.id });
      assert.ok(relationshipOne && relationshipTwo);
      fixture.relationshipIds = [relationshipOne.id, relationshipTwo.id];

      await db.insert(listingHousekeepingPreferencesTable).values([
        {
          userId: agentOne.id,
          whatsappEnabled: false,
          pushEnabled: false,
          emailEnabled: false,
        },
        {
          userId: agentTwo.id,
          whatsappEnabled: false,
          pushEnabled: false,
          emailEnabled: false,
        },
      ]);

      await runHousekeepingCycle();
      await runHousekeepingCycle();

      const events = await db.select().from(listingHousekeepingEventsTable)
        .where(eq(listingHousekeepingEventsTable.propertyId, property.id))
        .orderBy(asc(listingHousekeepingEventsTable.id));
      const relationshipOneEvents = events.filter(
        (event) => event.relationshipId === relationshipOne.id,
      );
      const relationshipTwoEvents = events.filter(
        (event) => event.relationshipId === relationshipTwo.id,
      );
      assert.deepEqual(
        relationshipOneEvents.map((event) => [
          event.eventType,
          event.newStatus,
          event.reminderKey,
        ]),
        [
          ["status_changed", "stale", null],
          ["reminder", "stale", "overdue-30"],
        ],
      );
      assert.deepEqual(relationshipTwoEvents, []);

      const relationships = await db.select({
        id: propertyAgentRelationshipsTable.id,
        freshnessStatus: propertyAgentRelationshipsTable.freshnessStatus,
      }).from(propertyAgentRelationshipsTable).where(
        inArray(propertyAgentRelationshipsTable.id, fixture.relationshipIds),
      );
      assert.deepEqual(
        new Map(
          relationships.map((relationship) => [
            relationship.id,
            relationship.freshnessStatus,
          ]),
        ),
        new Map([
          [relationshipOne.id, "stale"],
          [relationshipTwo.id, "fresh"],
        ]),
      );

      const notifications = await db.select().from(notificationsTable)
        .where(inArray(notificationsTable.userId, fixture.userIds));
      assert.equal(notifications.length, 1);
      const tasks = await db.select().from(tasksTable).where(and(
        eq(tasksTable.propertyId, property.id),
        eq(tasksTable.type, "listing_confirmation"),
      ));
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0]?.assigneeId, agentOne.id);
    } finally {
      if (fixture.userIds.length) {
        await db.delete(listingHousekeepingPreferencesTable)
          .where(inArray(listingHousekeepingPreferencesTable.userId, fixture.userIds));
        await db.delete(notificationsTable)
          .where(inArray(notificationsTable.userId, fixture.userIds));
      }
      if (fixture.propertyId !== undefined) {
        await db.delete(tasksTable)
          .where(eq(tasksTable.propertyId, fixture.propertyId));
        await db.delete(listingHousekeepingEventsTable)
          .where(eq(listingHousekeepingEventsTable.propertyId, fixture.propertyId));
      }
      if (fixture.relationshipIds.length) {
        await db.delete(propertyAgentRelationshipsTable).where(
          inArray(propertyAgentRelationshipsTable.id, fixture.relationshipIds),
        );
      }
      if (fixture.propertyId !== undefined) {
        await db.delete(propertiesTable)
          .where(eq(propertiesTable.id, fixture.propertyId));
      }
      if (fixture.userIds.length) {
        await db.delete(usersTable)
          .where(inArray(usersTable.id, fixture.userIds));
      }
      await database.pool.end();
    }
  },
);