// AI calorie estimation.
// Two providers, chosen from server/.env:
//   - Google Gemini (free tier): set GEMINI_API_KEY
//   - Claude (paid, pay-as-you-go): set ANTHROPIC_API_KEY
// If both keys are set, Gemini is used unless AI_PROVIDER=claude.
const { z } = require('zod');
const db = require('./db');

const EstimateSchema = z.object({
  items: z.array(
    z.object({
      food_name: z.string(),
      portion: z.string(),
      calories: z.number().int(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    })
  ),
  notes: z.string(),
});

class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function provider() {
  const wanted = (process.env.AI_PROVIDER || '').toLowerCase();
  if (wanted === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude';
  if (wanted === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

// The food list goes in the instructions so estimates match the app's own data.
// Built once so the text stays identical between calls.
let systemPrompt = null;
function getSystemPrompt() {
  if (systemPrompt) return systemPrompt;
  const foods = db
    .prepare("SELECT name, serving, calories, protein_g, carbs_g, fat_g FROM foods WHERE source = 'builtin' ORDER BY category, name")
    .all()
    .map((f) => `- ${f.name} | ${f.serving} | ${f.calories} kcal | P${f.protein_g} C${f.carbs_g} F${f.fat_g}`)
    .join('\n');

  systemPrompt = `You estimate calories and macronutrients for meals eaten by a user in Malaysia.
The user describes what they ate in English, Malay or a mix (e.g. "nasi campur: nasi, kuah kari kambing, sayur campur"), and may attach a photo.

Split the meal into its separate components (rice, each lauk, each vegetable, gravy, drink) and estimate each one.
Use typical Malaysian stall/home portions unless the user states amounts (e.g. "nasi separuh", "2 senduk", "banjir kuah").
When a component matches the reference list below, start from its values and scale by portion. Otherwise estimate from your own knowledge.
Name each item in the language the user used. "portion" is a short description such as "1 pinggan" or "1 senduk".
Calories are whole numbers; macros are grams with at most one decimal.
In "notes", write one or two short sentences: the main assumptions (portion sizes, oil, gravy) and how unsure the estimate is.
If the input is not food, return an empty items list and explain in notes.

Reference list (name | serving | kcal | protein, carbs, fat in grams):
${foods}`;
  return systemPrompt;
}

function parseImage(image) {
  if (!image) return null;
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image);
  if (!match) throw new AiError('Unsupported image format', 400);
  return { mediaType: match[1], data: match[2] };
}

const userText = (text) => (text?.trim() ? `What I ate: ${text.trim()}` : 'Estimate the food in this photo.');

// ---------------- Gemini (free tier) ----------------
// JSON schema Gemini must follow (same shape as EstimateSchema)
const geminiJsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          food_name: { type: 'string' },
          portion: { type: 'string' },
          calories: { type: 'integer' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['food_name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['items', 'notes'],
};

async function estimateWithGemini(text, img) {
  const { GoogleGenAI, ApiError } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const parts = [];
  if (img) parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  parts.push({ text: userText(text) });

  let response;
  try {
    response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: getSystemPrompt(),
        responseMimeType: 'application/json',
        responseJsonSchema: geminiJsonSchema,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      console.error('Gemini API error:', e.status, e.message);
      if (e.status === 429) throw new AiError('Free AI limit reached. Wait a minute (or until tomorrow for the daily limit) and try again.', 429);
      if (e.status === 400 && /api key/i.test(e.message)) throw new AiError('The GEMINI_API_KEY in server/.env was rejected. Check that it is correct.');
      if (e.status === 401 || e.status === 403) throw new AiError('The GEMINI_API_KEY in server/.env was rejected. Check that it is correct.');
      if (e.status === 404) throw new AiError('Gemini model not found. Set GEMINI_MODEL in server/.env to a current model name.');
      throw new AiError(`Gemini error (${e.status}). Try again in a moment.`);
    }
    throw new AiError('Could not reach Gemini. Check your internet connection.');
  }

  let data;
  try {
    data = EstimateSchema.parse(JSON.parse(response.text || ''));
  } catch {
    throw new AiError('The AI returned an unexpected answer. Please try again.');
  }
  return data;
}

// ---------------- Claude (paid) ----------------
async function estimateWithClaude(text, img) {
  const Anthropic = require('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
  const client = new Anthropic();
  const content = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  content.push({ type: 'text', text: userText(text) });

  let response;
  try {
    response = await client.beta.messages.parse({
      model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(EstimateSchema) },
      system: [{ type: 'text', text: getSystemPrompt(), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('The ANTHROPIC_API_KEY in server/.env was rejected. Check that it is correct.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Too many AI requests. Wait a minute and try again.', 429);
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API error:', e.status, e.message);
      throw new AiError(`AI service error (${e.status ?? 'network'}). Check your credits or try again.`);
    }
    throw e;
  }

  if (response.stop_reason === 'refusal') throw new AiError('The AI could not estimate this meal. Try describing it differently.', 422);
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new AiError('The AI returned an incomplete answer. Please try again.');
  return response.parsed_output;
}

// text: what the user ate. image: optional data URL ("data:image/jpeg;base64,...")
async function estimateMeal({ text, image }) {
  const img = parseImage(image);
  const p = provider();
  if (p === 'gemini') return estimateWithGemini(text, img);
  if (p === 'claude') return estimateWithClaude(text, img);
  throw new AiError('AI is not set up yet. Add GEMINI_API_KEY to server/.env and restart the server.', 503);
}

module.exports = { estimateMeal, provider, isConfigured: () => provider() !== null };
