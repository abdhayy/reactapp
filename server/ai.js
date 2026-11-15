// AI calorie estimation using the Claude API.
// Needs ANTHROPIC_API_KEY in server/.env (see README).
const Anthropic = require('@anthropic-ai/sdk');
const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { z } = require('zod');
const db = require('./db');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

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

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// The food list goes in the system prompt so estimates match the app's own data.
// Built once at startup so the prompt stays identical between calls (cacheable).
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

// text: what the user ate. image: optional data URL ("data:image/jpeg;base64,...")
async function estimateMeal({ text, image }) {
  const client = new Anthropic();
  const content = [];

  if (image) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image);
    if (!match) throw Object.assign(new Error('Unsupported image format'), { status: 400 });
    content.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
  }
  content.push({
    type: 'text',
    text: text?.trim() ? `What I ate: ${text.trim()}` : 'Estimate the food in this photo.',
  });

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(EstimateSchema) },
    system: [{ type: 'text', text: getSystemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw Object.assign(new Error('The AI could not estimate this meal. Try describing it differently.'), { status: 422 });
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw Object.assign(new Error('The AI returned an incomplete answer. Please try again.'), { status: 502 });
  }
  return response.parsed_output;
}

module.exports = { estimateMeal, isConfigured, Anthropic };
