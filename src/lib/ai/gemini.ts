import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { today } from "../dates";
import type { Category } from "../types";
import { normalizeReceipt, receiptJsonSchema, receiptPrompt, type ReceiptDraft } from "./receipt-schema";

/**
 * Gemini on Vertex AI. No API key: on Cloud Run the client authenticates as
 * the service account (roles/aiplatform.user), locally with gcloud ADC.
 * The "global" location is where the current Gemini models are served.
 */
let client: GoogleGenAI | null = null;

function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT ?? "expensetracker-mm",
    location: process.env.GEMINI_LOCATION ?? "global",
  });
  return client;
}

const model = () => process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

export async function readReceipt(
  image: { data: Buffer; mimeType: string },
  categories: Category[],
): Promise<ReceiptDraft | null> {
  const ids = categories.map((c) => c.id);
  const now = today();

  const response = await ai().models.generateContent({
    model: model(),
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: image.data.toString("base64"), mimeType: image.mimeType } },
          { text: receiptPrompt(categories, now) },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: receiptJsonSchema(ids),
      temperature: 0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: AbortSignal.timeout(60_000),
    },
  });

  const fallback = categories.find((c) => c.name === "Inne")?.id ?? ids[0];
  return normalizeReceipt(JSON.parse(response.text ?? "null"), new Set(ids), fallback, now);
}

/** The best category for an expense typed by hand, or null if the model is unsure. */
export async function suggestCategory(merchant: string, note: string, categories: Category[]): Promise<string | null> {
  const ids = categories.map((c) => c.id);
  const list = categories.map((c) => `- ${c.id}: ${c.name}`).join("\n");

  const response = await ai().models.generateContent({
    model: model(),
    contents: `Pick the category of this personal expense (Poland).
Merchant / description: ${JSON.stringify(merchant)}
Note: ${JSON.stringify(note)}
Categories:
${list}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: { categoryId: { type: "string", enum: ids } },
        required: ["categoryId"],
      },
      temperature: 0,
      // MINIMAL is rejected by the current Flash model (400 INVALID_ARGUMENT)
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: AbortSignal.timeout(15_000),
    },
  });

  const { categoryId } = JSON.parse(response.text ?? "{}") as { categoryId?: string };
  return categoryId && ids.includes(categoryId) ? categoryId : null;
}
