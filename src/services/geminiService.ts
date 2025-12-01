/**
 * Minimal geminiService used by App.tsx.
 * Exports the named functions App.tsx imports:
 *  - parseDocument
 *  - generateRiskAnalysis
 *  - checkAreaValuation
 *  - askUnderwriterAI
 *
 * This is the quick-testing client implementation (temporary).
 * If you are using an API key in the frontend for testing, use VITE_GEMINI_API_KEY
 * and be aware this exposes the key. For production move this to a server proxy.
 */

export interface GeminiResponse {
  summary: string;
  raw?: any;
}

export interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || (process.env.VITE_GEMINI_API_KEY as string) || '';

async function callGenerativeAPI(prompt: string): Promise<GeminiResponse> {
  if (!API_KEY) {
    // demo fallback
    return { summary: `DEMO: ${prompt}`, raw: { prompt } };
  }

  const MODEL = 'text-bison';
  const url = `https://generativelanguage.googleapis.com/v1beta2/models/${MODEL}:generateText?key=${encodeURIComponent(API_KEY)}`;
  const payload = { prompt: { text: prompt } };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Generative API error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  let summary = '';
  if (data?.candidates && data.candidates[0]?.output) summary = data.candidates[0].output;
  else if (data?.output && data.output[0]?.content) summary = data.output[0].content;
  else summary = JSON.stringify(data);

  return { summary, raw: data };
}

export async function parseDocument(fileData: string): Promise<ParsedDocument> {
  if (!API_KEY) return { text: String(fileData), metadata: {} };
  const prompt = `Extract the text and key fields from the following document:\n\n${fileData}`;
  const resp = await callGenerativeAPI(prompt);
  return { text: resp.summary, metadata: {} };
}

export async function generateRiskAnalysis(loanData: any): Promise<GeminiResponse> {
  const prompt = `Generate a concise risk analysis for the following loan data:\n${JSON.stringify(loanData)}`;
  return callGenerativeAPI(prompt);
}

export async function checkAreaValuation(addressOrLocation: string): Promise<GeminiResponse> {
  const prompt = `Provide an area valuation summary for: ${addressOrLocation}`;
  return callGenerativeAPI(prompt);
}

export async function askUnderwriterAI(question: string, context?: any): Promise<GeminiResponse> {
  const prompt = `Question: ${question}\nContext: ${JSON.stringify(context || {})}`;
  return callGenerativeAPI(prompt);
}

export async function getRiskReport(prompt: string): Promise<GeminiResponse> {
  return callGenerativeAPI(prompt);
}

export default getRiskReport;
