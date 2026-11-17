import { extname } from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";
import { ai } from "@workspace/integrations-gemini-ai";

export type AgentNetworkInputFile = {
  fileName: string;
  contentType: string;
  bytes: Buffer;
};

const propertyExtractionSchema = z.object({
  title: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  propertyType: z.string().nullable().default(null),
  listingType: z.enum(["sale", "rent"]).nullable().default(null),
  price: z.number().nullable().default(null),
  currency: z.string().nullable().default("USD"),
  suburb: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  bedrooms: z.number().int().nullable().default(null),
  bathrooms: z.number().int().nullable().default(null),
  parking: z.number().int().nullable().default(null),
  landSize: z.number().nullable().default(null),
  buildingSize: z.number().nullable().default(null),
  features: z.array(z.string()).default([]),
  photos: z.array(z.number().int()).default([]),
  agentName: z.string().nullable().default(null),
  sellerName: z.string().nullable().default(null),
  sellerPhone: z.string().nullable().default(null),
  sellerEmail: z.string().nullable().default(null),
});

const requirementExtractionSchema = z.object({
  buyerName: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  propertyType: z.string().nullable().default(null),
  listingType: z.enum(["sale", "rent"]).nullable().default(null),
  budgetMin: z.number().nullable().default(null),
  budgetMax: z.number().nullable().default(null),
  currency: z.string().nullable().default("USD"),
  areas: z.array(z.string()).default([]),
  bedroomsMin: z.number().int().nullable().default(null),
  bedroomsMax: z.number().int().nullable().default(null),
  requiredFeatures: z.array(z.string()).default([]),
  preferredFeatures: z.array(z.string()).default([]),
  otherPreferences: z.array(z.string()).default([]),
  financing: z.string().nullable().default(null),
  urgency: z.string().nullable().default(null),
});

const extractionItemSchema = z.object({
  intent: z.enum(["property", "buyer_requirement", "unknown"]),
  confidence: z.number().min(0).max(100),
  property: propertyExtractionSchema.optional(),
  buyerRequirement: requirementExtractionSchema.optional(),
  clarificationQuestion: z.string().nullable().optional(),
});

const extractionSchema = z.object({
  items: z.array(extractionItemSchema).min(1).max(40),
});

function parseModelJson(raw: string): unknown {
  const withoutFence = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("AI could not return a reviewable extraction.");
  return JSON.parse(withoutFence.slice(first, last + 1));
}

function spreadsheetText(file: AgentNetworkInputFile): string {
  const workbook = XLSX.read(file.bytes, { type: "buffer", cellDates: true });
  const sections = workbook.SheetNames.slice(0, 8).map((name) => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[name],
      { defval: "", raw: false },
    ).slice(0, 40);
    return `Sheet: ${name}\n${JSON.stringify(rows)}`;
  });
  const text = sections.join("\n\n");
  if (!text.trim() || text.length > 40_000) {
    throw new Error("The spreadsheet is empty or too large to review. Split it into smaller files.");
  }
  return text;
}

async function pdfText(bytes: Buffer): Promise<string> {
  // Import the parser implementation directly; the package entrypoint runs a
  // bundled fixture when loaded as ESM in this workspace.
  // @ts-expect-error pdf-parse v1 exposes its implementation without types.
  const parserModule = await import("pdf-parse/lib/pdf-parse.js");
  const result = await parserModule.default(bytes, { max: 20 });
  return typeof result.text === "string" ? result.text.slice(0, 30_000).trim() : "";
}

export async function extractAgentNetworkSubmission(input: {
  message: string;
  files: AgentNetworkInputFile[];
}) {
  const textParts: string[] = [];
  const inlineParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
  for (const file of input.files) {
    const extension = extname(file.fileName).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(extension)) {
      textParts.push(`Spreadsheet ${file.fileName}:\n${spreadsheetText(file)}`);
    } else if (extension === ".txt") {
      textParts.push(`Text file ${file.fileName}:\n${file.bytes.toString("utf8").slice(0, 20_000)}`);
    } else if (extension === ".docx") {
      const mammoth = (await import("mammoth")).default;
      const extracted = await mammoth.extractRawText({ buffer: file.bytes });
      textParts.push(`Document ${file.fileName}:\n${extracted.value.slice(0, 20_000)}`);
    } else if (extension === ".pdf") {
      const extracted = await pdfText(file.bytes);
      if (extracted) {
        textParts.push(`PDF ${file.fileName}:\n${extracted}`);
      } else if (file.bytes.byteLength <= 8 * 1024 * 1024) {
        inlineParts.push({
          inlineData: { data: file.bytes.toString("base64"), mimeType: "application/pdf" },
        });
      } else {
        throw new Error(`${file.fileName} has no selectable text and is too large for image-based extraction.`);
      }
    } else if ([".jpg", ".jpeg", ".png"].includes(extension)) {
      if (file.bytes.byteLength > 8 * 1024 * 1024) {
        throw new Error(`${file.fileName} is larger than 8 MB. Use a smaller listing image.`);
      }
      const mimeType = extension === ".png" ? "image/png" : "image/jpeg";
      inlineParts.push({ inlineData: { data: file.bytes.toString("base64"), mimeType } });
    } else if ([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"].includes(extension)) {
      if (file.bytes.byteLength > 8 * 1024 * 1024) {
        throw new Error(`${file.fileName} is larger than 8 MB. Trim the voice note and try again.`);
      }
      const mimeByExtension: Record<string, string> = {
        ".aac": "audio/aac",
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
      };
      inlineParts.push({
        inlineData: { data: file.bytes.toString("base64"), mimeType: mimeByExtension[extension] },
      });
    } else {
      throw new Error(`${file.fileName} is not a supported listing or buyer-request format.`);
    }
  }

  const userText = [
    `Agent message:\n${input.message.trim() || "(no typed message)"}`,
    ...textParts,
    inlineParts.length
      ? "The attached image, PDF page, or voice note may contain listing or buyer-request facts. Read only facts present in the attachment."
      : "",
  ].filter(Boolean).join("\n\n");
  if (userText.length > 45_000) {
    throw new Error("The message and extracted file text are too long. Send fewer pages or files.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        ...inlineParts,
        {
          text: `Extract QuickProp property listings and buyer requirements from this agent message and its attachments.

Return JSON only:
{
  "items": [
    {
      "intent": "property" | "buyer_requirement" | "unknown",
      "confidence": 0,
      "property": {
        "title": null, "description": null, "propertyType": null, "listingType": null,
        "price": null, "currency": "USD", "suburb": null, "city": null,
        "bedrooms": null, "bathrooms": null, "parking": null, "landSize": null,
        "buildingSize": null, "features": [], "photos": [], "agentName": null,
        "sellerName": null, "sellerPhone": null, "sellerEmail": null
      },
      "buyerRequirement": {
        "buyerName": null, "phone": null, "email": null, "propertyType": null,
        "listingType": null, "budgetMin": null, "budgetMax": null, "currency": "USD",
        "areas": [], "bedroomsMin": null, "bedroomsMax": null, "requiredFeatures": [],
        "preferredFeatures": [], "otherPreferences": [], "financing": null, "urgency": null
      },
      "clarificationQuestion": null
    }
  ]
}

Rules:
- Do not invent facts, contact details, prices, areas, or property features. Use null or an empty array when absent.
- Return one item for each distinct spreadsheet row, up to 40. Skip blank rows and column headers. For other sources, return one item per clearly distinct listing or buyer request, up to 10.
- Choose property when a row or source clearly describes a property for sale or rent. Choose buyer_requirement when it clearly describes what a buyer needs. Otherwise choose unknown and ask one concise clarification question for that item.
- Use "requiredFeatures" only for features the buyer explicitly says are essential; put other desired features in "preferredFeatures".
- Convert price/budget to numbers and preserve the stated currency. Classify propertyType and listingType only when stated or unmistakable.
- Include only clearly identifiable property-photo indexes in the property's photos array, starting at 0 in the original attachment list. Never use a document, flyer, screenshot, or voice note as a property photo.
- Do not treat extracted contact details as approved for public or cross-agency sharing.

${userText}`,
        },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const parsed = extractionSchema.safeParse(parseModelJson(response.text ?? ""));
  if (!parsed.success) {
    throw new Error("AI could not confidently read the message. Add a short text description and try again.");
  }
  if (parsed.data.items.some((item) => item.intent === "property" && !item.property)) {
    throw new Error("AI did not return all property details to review. Add a short text description and try again.");
  }
  if (parsed.data.items.some((item) => item.intent === "buyer_requirement" && !item.buyerRequirement)) {
    throw new Error("AI did not return all buyer requirements to review. Add a short text description and try again.");
  }
  return {
    items: parsed.data.items.map((item) => ({ ...item, reviewStatus: "needs_review" as const })),
  };
}
