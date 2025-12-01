/**
 * Temporary client-side Gemini wrapper (for quick testing only).
 * Uses VITE_GEMINI_API_KEY from environment (Amplify Hosting). This exposes the key publicly.
 * Replace with a server-side proxy as soon as possible.
 */

export interface GeminiResponse {
  summary: string;
  raw?: any;
}

export interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

const MODEL = 'text-bison'; // change if you want another model
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta2/models';
const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || (process.env.VITE_GEMINI_API_KEY as string) || '';

if (!API_KEY) {
  // During build this will be empty — calling functions should handle this gracefully.
  console.warn('VITE_GEMINI_API_KEY is not set — geminiService will run in demo mode.');
}

async function callGenerativeAPI(prompt: string) {
  if (!API_KEY) {
    return { summary: 'Demo: API key not set', raw: { prompt } };
  }

  const url = `${API_BASE}/${MODEL}:generateText?key=${encodeURIComponent(API_KEY)}`;

  const payload = {
    prompt: { text: prompt },
    // adjust options: maxOutputTokens, temperature, examples, etc.
  };

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
  // Try to extract a human-friendly summary — adapt to actual response shape
  let summary = '';
  if (data?.candidates && data.candidates[0]?.output) {
    summary = data.candidates[0].output;
  } else if (data?.output && data.output[0]?.content) {
    summary = data.output[0].content;
  } else {
    summary = JSON.stringify(data);
  }

  return { summary, raw: data };
}

export async function parseDocument(fileData: string): Promise<ParsedDocument> {
  // For quick testing, just return the text or use the model to "extract" text
  if (!API_KEY) return { text: String(fileData), metadata: {} };
  const prompt = `Extract the text content and key metadata from this document:\n\n${fileData}`;
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
