import {
  db,
  branchesTable,
  usersTable,
  sellersTable,
  buyersTable,
  buyerRequestsTable,
  propertiesTable,
  priceHistoryTable,
  activityTable,
  leadsTable,
  leadTimelineTable,
  tasksTable,
  viewingsTable,
  documentsTable,
  notificationsTable,
  auditLogTable,
} from "@workspace/db";
import { logger } from "./lib/logger";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}
function daysAhead(n: number): Date {
  return new Date(Date.now() + n * 24 * 3600 * 1000);
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function seed(): Promise<void> {
  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    logger.info("Database already seeded, skipping");
    return;
  }

  const [hq, borrowdale] = await db
    .insert(branchesTable)
    .values([
      { name: "Harare CBD (Head Office)", address: "5th Floor, Karigamombe Centre, Samora Machel Ave", phone: "+263 24 275 1234" },
      { name: "Borrowdale Branch", address: "Sam Levy's Village, Borrowdale", phone: "+263 24 288 5678" },
    ])
    .returning();

  const users = await db
    .insert(usersTable)
    .values([
      { name: "Rutendo Moyo", email: "rutendo@quickprop.co.zw", phone: "+263 77 234 5678", role: "principal", branchId: hq.id },
      { name: "Tawanda Ncube", email: "tawanda@quickprop.co.zw", phone: "+263 77 345 6789", role: "senior_agent", branchId: hq.id },
      { name: "Chipo Marufu", email: "chipo@quickprop.co.zw", phone: "+263 78 456 7890", role: "agent", branchId: borrowdale.id },
      { name: "Kudzai Dube", email: "kudzai@quickprop.co.zw", phone: "+263 71 567 8901", role: "agent", branchId: borrowdale.id },
      { name: "Nyasha Chikore", email: "nyasha@quickprop.co.zw", phone: "+263 77 678 9012", role: "admin", branchId: hq.id },
      { name: "Tariro Gonzo", email: "tariro@quickprop.co.zw", phone: "+263 78 789 0123", role: "marketing", branchId: hq.id },
    ])
    .returning();
  const [rutendo, tawanda, chipo, kudzai, nyasha, tariro] = users;

  const sellers = await db
    .insert(sellersTable)
    .values([
      { name: "Farai Mutasa", idNumber: "63-123456A63", phone: "+263 77 111 2222", email: "farai.mutasa@gmail.com", postalAddress: "12 Hurworth Rd, Highlands" },
      { name: "Grace Chigumba", idNumber: "63-234567B63", phone: "+263 78 222 3333", email: "gracec@yahoo.com", postalAddress: "8 Crowhill Rd, Borrowdale" },
      { name: "Blessing Sibanda", idNumber: "08-345678C08", phone: "+263 71 333 4444", email: "blessing.sib@gmail.com" },
      { name: "Diaspora Trust (Mukono family)", phone: "+44 7700 900123", email: "mukonotrust@outlook.com", notes: "UK-based sellers, prefer WhatsApp, GMT timezone" },
      { name: "Tendai Mapfumo", idNumber: "63-456789D63", phone: "+263 77 444 5555", email: "tmapfumo@gmail.com" },
      { name: "Rosewood Investments (Pvt) Ltd", phone: "+263 24 270 9876", email: "admin@rosewood.co.zw", notes: "Company seller — decisions via board, allow extra time" },
    ])
    .returning();

  const propData: (typeof propertiesTable.$inferInsert)[] = [
    { reference: "QP-0001", title: "4-Bed Family Home with Pool", description: "Immaculate family home on a lush half-acre in Borrowdale. Solar backup, borehole, staff quarters.", propertyType: "house", listingType: "sale", status: "public", pipelineStage: "published", price: 320000, suburb: "Borrowdale", city: "Harare", address: "15 Crowhill Road", bedrooms: 4, bathrooms: 3, parking: 2, landSize: 2023, features: ["pool", "borehole", "solar", "staff quarters", "walled"], agentId: tawanda.id, branchId: borrowdale.id, sellerId: sellers[1].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(60)), mandateExpiry: dateStr(daysAhead(120)), commissionPercent: 5, views: 342, enquiries: 18, shares: 7, hasBrochure: true, publishedAt: daysAgo(55), createdAt: daysAgo(60), updatedAt: daysAgo(3) },
    { reference: "QP-0002", title: "Modern 2-Bed Apartment, Avondale", description: "Lock-up-and-go apartment near shops. 24hr security, prepaid ZESA.", propertyType: "apartment", listingType: "sale", status: "public", pipelineStage: "published", price: 95000, suburb: "Avondale", city: "Harare", address: "Unit 7, Rhapsody Court, King George Rd", bedrooms: 2, bathrooms: 1, parking: 1, features: ["security", "prepaid ZESA", "balcony"], agentId: chipo.id, branchId: hq.id, sellerId: sellers[0].id, mandateType: "open", mandateStart: dateStr(daysAgo(40)), mandateExpiry: dateStr(daysAhead(20)), commissionPercent: 5, views: 187, enquiries: 9, shares: 3, hasBrochure: true, publishedAt: daysAgo(38), createdAt: daysAgo(40), updatedAt: daysAgo(20) },
    { reference: "QP-0003", title: "Highlands Executive Townhouse", description: "3-bed townhouse in secure complex, garden flat, double garage.", propertyType: "townhouse", listingType: "sale", status: "under_offer", pipelineStage: "under_offer", price: 210000, suburb: "Highlands", city: "Harare", address: "4 The Willows, Enterprise Rd", bedrooms: 3, bathrooms: 2, parking: 2, features: ["complex", "garden", "double garage"], agentId: tawanda.id, branchId: hq.id, sellerId: sellers[4].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(90)), mandateExpiry: dateStr(daysAhead(25)), commissionPercent: 5, views: 264, enquiries: 14, shares: 5, hasBrochure: true, publishedAt: daysAgo(85), createdAt: daysAgo(90), updatedAt: daysAgo(5) },
    { reference: "QP-0004", title: "2000sqm Residential Stand, Ruwa", description: "Level stand in Damofalls, title deeds available, water and power at boundary.", propertyType: "stand", listingType: "sale", status: "public", pipelineStage: "published", price: 28000, suburb: "Ruwa", city: "Ruwa", address: "Stand 448 Damofalls Phase 2", landSize: 2000, features: ["title deeds", "serviced"], agentId: kudzai.id, branchId: borrowdale.id, sellerId: sellers[2].id, mandateType: "open", mandateStart: dateStr(daysAgo(30)), mandateExpiry: dateStr(daysAhead(60)), commissionPercent: 7.5, views: 98, enquiries: 6, shares: 2, publishedAt: daysAgo(28), createdAt: daysAgo(30), updatedAt: daysAgo(28) },
    { reference: "QP-0005", title: "CBD Office Floor, 450sqm", description: "Whole floor in Karigamombe Centre. Generator backup, fibre ready.", propertyType: "commercial", listingType: "rent", status: "public", pipelineStage: "published", price: 3600, suburb: "CBD", city: "Harare", address: "9th Floor, Karigamombe Centre", buildingSize: 450, features: ["generator", "fibre", "lift"], agentId: rutendo.id, branchId: hq.id, sellerId: sellers[5].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(15)), mandateExpiry: dateStr(daysAhead(165)), commissionPercent: 10, views: 45, enquiries: 3, shares: 1, publishedAt: daysAgo(12), createdAt: daysAgo(15), updatedAt: daysAgo(12) },
    { reference: "QP-0006", title: "Charming 3-Bed Cottage, Mount Pleasant", description: "Character home near university. Mature garden, needs light renovation.", propertyType: "house", listingType: "sale", status: "internal_only", pipelineStage: "ready", price: 145000, suburb: "Mount Pleasant", city: "Harare", address: "23 Ridgeway North", bedrooms: 3, bathrooms: 2, parking: 1, landSize: 1200, features: ["garden", "borehole"], agentId: chipo.id, branchId: hq.id, sellerId: sellers[0].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(10)), mandateExpiry: dateStr(daysAhead(80)), commissionPercent: 5, views: 12, enquiries: 1, createdAt: daysAgo(10), updatedAt: daysAgo(2) },
    { reference: "QP-0007", title: "Diaspora Sale: 5-Bed Glen Lorne Home", description: "Sprawling home on 1 acre with cottage. Sold on behalf of UK-based family.", propertyType: "house", listingType: "sale", status: "private_listing", pipelineStage: "ready", price: 450000, suburb: "Glen Lorne", city: "Harare", address: "7 Umwinsidale Rd", bedrooms: 5, bathrooms: 4, parking: 3, landSize: 4046, features: ["cottage", "pool", "borehole", "solar", "electric fence"], agentId: rutendo.id, branchId: hq.id, sellerId: sellers[3].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(20)), mandateExpiry: dateStr(daysAhead(160)), commissionPercent: 5, privateNotes: "Seller wants discreet sale — no public advertising. Qualified buyers only.", views: 8, enquiries: 2, createdAt: daysAgo(20), updatedAt: daysAgo(4) },
    { reference: "QP-0008", title: "Waterfalls Starter Home", description: "Solid 3-bed home, walled and gated. Great first-time buy.", propertyType: "house", listingType: "sale", status: "draft", pipelineStage: "awaiting_photos", price: 65000, suburb: "Waterfalls", city: "Harare", address: "112 Derbyshire Rd", bedrooms: 3, bathrooms: 1, parking: 1, landSize: 800, features: ["walled", "gated"], agentId: kudzai.id, branchId: borrowdale.id, sellerId: sellers[2].id, mandateType: "open", mandateStart: dateStr(daysAgo(5)), mandateExpiry: dateStr(daysAhead(85)), commissionPercent: 6, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { reference: "QP-0009", title: "Newlands Garden Flat to Let", description: "Private 1-bed garden flat, own entrance, includes water.", propertyType: "apartment", listingType: "rent", status: "rented", pipelineStage: "sold", price: 450, suburb: "Newlands", city: "Harare", bedrooms: 1, bathrooms: 1, parking: 1, features: ["garden", "own entrance"], agentId: chipo.id, branchId: hq.id, sellerId: sellers[4].id, mandateType: "open", commissionPercent: 10, views: 156, enquiries: 11, shares: 4, createdAt: daysAgo(75), updatedAt: daysAgo(15) },
    { reference: "QP-0010", title: "SOLD: Greendale Family Home", description: "4-bed home with pool — sold above asking.", propertyType: "house", listingType: "sale", status: "sold", pipelineStage: "sold", price: 185000, suburb: "Greendale", city: "Harare", bedrooms: 4, bathrooms: 2, parking: 2, landSize: 1800, features: ["pool", "borehole"], agentId: tawanda.id, branchId: hq.id, sellerId: sellers[0].id, mandateType: "exclusive", commissionPercent: 5, views: 410, enquiries: 22, shares: 9, hasBrochure: true, createdAt: daysAgo(150), updatedAt: daysAgo(30) },
    { reference: "QP-0011", title: "Coming Soon: Chisipite Cluster Homes", description: "New development of 6 cluster homes, launching next month.", propertyType: "townhouse", listingType: "sale", status: "coming_soon", pipelineStage: "ready", price: 260000, suburb: "Chisipite", city: "Harare", bedrooms: 3, bathrooms: 3, parking: 2, features: ["new build", "complex", "solar"], agentId: tariro.id, branchId: hq.id, sellerId: sellers[5].id, mandateType: "exclusive", mandateStart: dateStr(daysAgo(7)), mandateExpiry: dateStr(daysAhead(173)), commissionPercent: 4, createdAt: daysAgo(7), updatedAt: daysAgo(1) },
    { reference: "QP-0012", title: "10-Hectare Smallholding, Goromonzi", description: "Productive plot with 3-bed farmhouse, tobacco barns, 2 boreholes.", propertyType: "farm", listingType: "sale", status: "public", pipelineStage: "published", price: 120000, suburb: "Goromonzi", city: "Goromonzi", landSize: 100000, bedrooms: 3, bathrooms: 1, features: ["boreholes", "barns", "arable"], agentId: kudzai.id, branchId: borrowdale.id, sellerId: sellers[2].id, mandateType: "open", mandateStart: dateStr(daysAgo(45)), mandateExpiry: dateStr(daysAhead(15)), commissionPercent: 7.5, views: 76, enquiries: 4, shares: 2, publishedAt: daysAgo(42), createdAt: daysAgo(45), updatedAt: daysAgo(40) },
  ];
  const props = await db.insert(propertiesTable).values(propData).returning();

  await db.insert(priceHistoryTable).values([
    { propertyId: props[0].id, price: 335000, changedAt: daysAgo(60), changedBy: "Tawanda Ncube" },
    { propertyId: props[0].id, price: 320000, previousPrice: 335000, changedAt: daysAgo(25), changedBy: "Tawanda Ncube" },
    { propertyId: props[2].id, price: 225000, changedAt: daysAgo(90), changedBy: "Tawanda Ncube" },
    { propertyId: props[2].id, price: 210000, previousPrice: 225000, changedAt: daysAgo(40), changedBy: "Rutendo Moyo" },
    ...props.filter((_, i) => ![0, 2].includes(i)).map((p) => ({ propertyId: p.id, price: p.price, changedAt: p.createdAt, changedBy: "System" })),
  ]);

  const buyers = await db
    .insert(buyersTable)
    .values([
      { name: "Simba Chikwanda", phone: "+263 77 888 9999", email: "simbac@gmail.com", budgetMin: 250000, budgetMax: 350000, preferredAreas: ["Borrowdale", "Highlands", "Chisipite"], propertyType: "house", bedroomsMin: 4, features: ["pool", "borehole"], financing: "cash", urgency: "hot", agentId: tawanda.id, notes: "Relocating from Bulawayo, needs to move by September" },
      { name: "Dr. Anesu Mhike", phone: "+263 78 777 6666", email: "anesu.mhike@gmail.com", budgetMax: 120000, preferredAreas: ["Avondale", "Mount Pleasant", "Newlands"], propertyType: "apartment", bedroomsMin: 2, financing: "mortgage", urgency: "warm", agentId: chipo.id },
      { name: "Munya & Rudo Zvobgo", phone: "+44 7911 123456", email: "mzvobgo@hotmail.co.uk", budgetMin: 300000, budgetMax: 500000, preferredAreas: ["Glen Lorne", "Borrowdale", "Umwinsidale"], propertyType: "house", bedroomsMin: 4, features: ["cottage", "solar"], financing: "diaspora", urgency: "warm", agentId: rutendo.id, notes: "UK diaspora couple, buying for retirement. Video viewings preferred." },
      { name: "Tinashe Gwara", phone: "+263 71 555 4444", budgetMax: 35000, preferredAreas: ["Ruwa", "Damofalls", "Zimre Park"], propertyType: "stand", financing: "cash", urgency: "hot", agentId: kudzai.id },
      { name: "Panashe Holdings", phone: "+263 24 279 1111", email: "property@panashe.co.zw", budgetMax: 5000, preferredAreas: ["CBD", "Msasa"], propertyType: "commercial", financing: "cash", urgency: "cold", agentId: rutendo.id, notes: "Looking to lease office space, 300-500sqm" },
    ])
    .returning();

  const requests = await db
    .insert(buyerRequestsTable)
    .values([
      { buyerName: "Chenai Mafukidze", phone: "+263 77 121 3434", requestText: "Looking for a 3 bedroom house in Mount Pleasant or Avondale under $150k, must have a borehole", budgetMax: 150000, areas: ["Mount Pleasant", "Avondale"], propertyType: "house", status: "new", agentId: chipo.id },
      { buyerName: "Brian Togarepi", phone: "+263 78 232 4545", requestText: "Stand in Ruwa around $30k, cash buyer, title deeds essential", budgetMax: 32000, areas: ["Ruwa"], propertyType: "stand", status: "in_progress", agentId: kudzai.id },
      { buyerName: "Mercy Nhongo", email: "mercy.n@gmail.com", requestText: "2 bed flat to rent in Newlands or Milton Park, max $500/month", budgetMax: 500, areas: ["Newlands", "Milton Park"], propertyType: "apartment", status: "new" },
      { buyerName: "Josphat Mugadza", phone: "+263 71 343 5656", requestText: "Small farm within 50km of Harare, up to $150k, must have water", budgetMax: 150000, areas: ["Goromonzi", "Domboshava"], propertyType: "farm", status: "matched", agentId: kudzai.id },
    ])
    .returning();

  const leads = await db
    .insert(leadsTable)
    .values([
      { name: "Simba Chikwanda", phone: "+263 77 888 9999", email: "simbac@gmail.com", source: "referral", stage: "viewing_booked", propertyId: props[0].id, agentId: tawanda.id, notes: "Very keen on Crowhill Rd house", createdAt: daysAgo(8), updatedAt: daysAgo(1) },
      { name: "Dr. Anesu Mhike", phone: "+263 78 777 6666", source: "property_gram", stage: "attempted_contact", propertyId: props[1].id, agentId: chipo.id, createdAt: daysAgo(4), updatedAt: daysAgo(2) },
      { name: "Munya Zvobgo", email: "mzvobgo@hotmail.co.uk", source: "whatsapp", stage: "negotiation", propertyId: props[6].id, agentId: rutendo.id, notes: "Offer at $430k on table, seller wants $445k", createdAt: daysAgo(12), updatedAt: daysAgo(1) },
      { name: "Rumbidzai Katsande", phone: "+263 77 656 7878", source: "walk_in", stage: "new", propertyId: props[1].id, agentId: chipo.id, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { name: "Brighton Zhou", phone: "+263 78 767 8989", source: "facebook", stage: "new", propertyId: props[3].id, agentId: kudzai.id, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
      { name: "Fadzai Murwira", phone: "+263 71 878 9090", source: "website", stage: "offer_received", propertyId: props[2].id, agentId: tawanda.id, notes: "Offered full asking, awaiting agreement of sale", createdAt: daysAgo(20), updatedAt: daysAgo(5) },
      { name: "Kuda Mavhunga", phone: "+263 77 989 0101", source: "referral", stage: "completed", propertyId: props[9].id, agentId: tawanda.id, notes: "Purchased Greendale home", createdAt: daysAgo(120), updatedAt: daysAgo(30) },
      { name: "Lisa Choto", phone: "+263 78 090 1212", source: "property_gram", stage: "lost", propertyId: props[1].id, agentId: chipo.id, notes: "Bought elsewhere", createdAt: daysAgo(35), updatedAt: daysAgo(10) },
    ])
    .returning();

  await db.insert(leadTimelineTable).values([
    { leadId: leads[0].id, type: "note", content: "Lead created from referral", userName: "Tawanda Ncube", createdAt: daysAgo(8) },
    { leadId: leads[0].id, type: "call", content: "Spoke to Simba — very motivated, cash buyer relocating from Bulawayo", userName: "Tawanda Ncube", createdAt: daysAgo(7) },
    { leadId: leads[0].id, type: "viewing", content: "Viewing booked for Saturday 10am at QP-0001", userName: "Tawanda Ncube", createdAt: daysAgo(1) },
    { leadId: leads[2].id, type: "note", content: "Lead created from WhatsApp enquiry", userName: "Rutendo Moyo", createdAt: daysAgo(12) },
    { leadId: leads[2].id, type: "meeting", content: "Video call with the Zvobgos — walked through the Glen Lorne property live", userName: "Rutendo Moyo", createdAt: daysAgo(6) },
    { leadId: leads[2].id, type: "note", content: "Written offer received: $430,000. Presented to seller trust.", userName: "Rutendo Moyo", createdAt: daysAgo(2) },
    { leadId: leads[5].id, type: "note", content: "Full asking price offer received", userName: "Tawanda Ncube", createdAt: daysAgo(5) },
  ]);

  await db.insert(tasksTable).values([
    { title: "Photograph Waterfalls house (QP-0008)", type: "photos", assigneeId: tariro.id, propertyId: props[7].id, dueDate: dateStr(daysAhead(2)), priority: "high", status: "open" },
    { title: "Renew mandate for Avondale apartment (QP-0002)", type: "mandate", assigneeId: chipo.id, propertyId: props[1].id, dueDate: dateStr(daysAhead(10)), priority: "high", status: "open" },
    { title: "Follow up Dr. Mhike — 2nd contact attempt", type: "follow_up", assigneeId: chipo.id, leadId: leads[1].id, dueDate: dateStr(daysAhead(1)), priority: "medium", status: "open" },
    { title: "Draft agreement of sale for Highlands townhouse", type: "legal", assigneeId: nyasha.id, propertyId: props[2].id, dueDate: dateStr(daysAhead(3)), priority: "urgent", status: "in_progress" },
    { title: "Weekly WhatsApp status broadcast", type: "marketing", assigneeId: tariro.id, dueDate: dateStr(daysAhead(4)), priority: "low", status: "open", recurring: true },
    { title: "Collect title deed copy from Goromonzi seller", type: "compliance", assigneeId: kudzai.id, propertyId: props[11].id, dueDate: dateStr(daysAgo(2)), priority: "high", status: "open" },
    { title: "Order For Sale board for Mount Pleasant cottage", type: "marketing", assigneeId: tariro.id, propertyId: props[5].id, dueDate: dateStr(daysAgo(1)), priority: "medium", status: "done" },
  ]);

  await db.insert(viewingsTable).values([
    { propertyId: props[0].id, buyerName: "Simba Chikwanda", leadId: leads[0].id, agentId: tawanda.id, scheduledAt: daysAhead(2), status: "scheduled" },
    { propertyId: props[1].id, buyerName: "Rumbidzai Katsande", leadId: leads[3].id, agentId: chipo.id, scheduledAt: new Date(Date.now() + 4 * 3600 * 1000), status: "scheduled" },
    { propertyId: props[3].id, buyerName: "Brighton Zhou", leadId: leads[4].id, agentId: kudzai.id, scheduledAt: daysAhead(3), status: "scheduled" },
    { propertyId: props[2].id, buyerName: "Fadzai Murwira", leadId: leads[5].id, agentId: tawanda.id, scheduledAt: daysAgo(15), status: "completed", outcome: "offer_made", notes: "Loved it, offered asking price" },
    { propertyId: props[0].id, buyerName: "Walk-in couple", agentId: tawanda.id, scheduledAt: daysAgo(6), status: "completed", outcome: "not_interested", notes: "Pool too small for their needs" },
    { propertyId: props[6].id, buyerName: "Munya Zvobgo (video)", leadId: leads[2].id, agentId: rutendo.id, scheduledAt: daysAgo(6), status: "completed", outcome: "offer_made" },
    { propertyId: props[1].id, buyerName: "Dr. Anesu Mhike", leadId: leads[1].id, agentId: chipo.id, scheduledAt: daysAgo(1), status: "no_show", notes: "Did not arrive, reschedule" },
  ]);

  await db.insert(documentsTable).values([
    { name: "QP-0001 Exclusive Mandate.pdf", category: "mandate", propertyId: props[0].id, sizeKb: 245, uploadedBy: "Tawanda Ncube", createdAt: daysAgo(60) },
    { name: "QP-0001 Title Deed Copy.pdf", category: "title_deed", propertyId: props[0].id, sizeKb: 1890, uploadedBy: "Nyasha Chikore", createdAt: daysAgo(58) },
    { name: "QP-0003 Agreement of Sale DRAFT.docx", category: "agreement", propertyId: props[2].id, sizeKb: 87, version: 2, uploadedBy: "Nyasha Chikore", createdAt: daysAgo(3) },
    { name: "QP-0007 Power of Attorney (Mukono Trust).pdf", category: "legal", propertyId: props[6].id, sizeKb: 412, uploadedBy: "Rutendo Moyo", createdAt: daysAgo(18) },
    { name: "QP-0010 Capital Gains Clearance.pdf", category: "compliance", propertyId: props[9].id, sizeKb: 156, uploadedBy: "Nyasha Chikore", createdAt: daysAgo(32) },
    { name: "Agency Registration Certificate 2026.pdf", category: "compliance", sizeKb: 324, uploadedBy: "Rutendo Moyo", createdAt: daysAgo(180) },
  ]);

  await db.insert(activityTable).values([
    { type: "created", message: "New mandate QP-0011: Coming Soon: Chisipite Cluster Homes", entityType: "property", entityId: props[10].id, userName: "Tariro Gonzo", createdAt: daysAgo(7) },
    { type: "enquiry", message: "New lead: Brighton Zhou enquired about QP-0004", entityType: "lead", entityId: leads[4].id, userName: "Kudzai Dube", createdAt: daysAgo(0) },
    { type: "status_change", message: "QP-0003 moved to under offer", entityType: "property", entityId: props[2].id, userName: "Tawanda Ncube", createdAt: daysAgo(5) },
    { type: "price_change", message: "QP-0001 price reduced to $320,000", entityType: "property", entityId: props[0].id, userName: "Tawanda Ncube", createdAt: daysAgo(25) },
    { type: "viewing", message: "Viewing scheduled with Simba Chikwanda at QP-0001", entityType: "property", entityId: props[0].id, userName: "Tawanda Ncube", createdAt: daysAgo(1) },
    { type: "share", message: "QP-0001 shared via whatsapp", entityType: "property", entityId: props[0].id, userName: "Tariro Gonzo", createdAt: daysAgo(3) },
    { type: "enquiry", message: "New lead: Rumbidzai Katsande walked in about QP-0002", entityType: "lead", entityId: leads[3].id, userName: "Chipo Marufu", createdAt: daysAgo(1) },
  ]);

  await db.insert(notificationsTable).values([
    { userId: rutendo.id, type: "mandate_expiry", title: "Mandate expiring: QP-0002", message: "Avondale apartment mandate expires in 20 days", createdAt: daysAgo(1) },
    { userId: rutendo.id, type: "offer", title: "Offer received on QP-0007", message: "Munya Zvobgo offered $430,000 on the Glen Lorne home", createdAt: daysAgo(2) },
    { userId: rutendo.id, type: "lead", title: "2 new leads today", message: "Brighton Zhou and Rumbidzai Katsande are awaiting contact", createdAt: daysAgo(0) },
    { userId: rutendo.id, type: "task", title: "Overdue task", message: "Title deed collection for QP-0012 is overdue", read: false, createdAt: daysAgo(1) },
    { userId: rutendo.id, type: "viewing", title: "Viewing today at 2pm", message: "Rumbidzai Katsande viewing QP-0002 with Chipo", createdAt: daysAgo(0) },
  ]);

  await db.insert(auditLogTable).values([
    { userId: tawanda.id, userName: "Tawanda Ncube", action: "edited", entityType: "property", entityId: props[0].id, detail: "Price reduced from $335,000 to $320,000", createdAt: daysAgo(25) },
    { userId: rutendo.id, userName: "Rutendo Moyo", action: "created", entityType: "property", entityId: props[6].id, detail: "Created QP-0007 as private listing", createdAt: daysAgo(20) },
    { userId: nyasha.id, userName: "Nyasha Chikore", action: "created", entityType: "document", entityId: null, detail: "Uploaded QP-0003 Agreement of Sale DRAFT", createdAt: daysAgo(3) },
    { userId: tawanda.id, userName: "Tawanda Ncube", action: "edited", entityType: "property", entityId: props[2].id, detail: "Status changed to under_offer", createdAt: daysAgo(5) },
    { userId: rutendo.id, userName: "Rutendo Moyo", action: "login", entityType: "user", entityId: rutendo.id, detail: "Rutendo Moyo logged in", createdAt: daysAgo(0) },
  ]);

  logger.info("Seed complete");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err, "Seed failed");
    process.exit(1);
  });
