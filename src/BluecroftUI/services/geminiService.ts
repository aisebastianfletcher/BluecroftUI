/**
 * Gemini service stubs required by App.tsx.
 *
 * Exports:
 *  - parseDocument
 *  - generateRiskAnalysis
 *  - checkAreaValuation
 *  - askUnderwriterAI
 *  - getRiskReport (default)
 *
 * These are lightweight placeholders so the app can build. Replace with
 * a secure server-side integration when ready.
 */

export interface GeminiResponse {
  summary: string;
  raw?: any;
}

export interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

const DEMO_PREFIX = 'DEMO:';

/**
 * parseDocument
 * - Lightweight parser stub: returns the input as text when no API key is available.
 */
export async function parseDocument(fileData: string): Promise<ParsedDocument> {
  // If you later wire a backend, call it here instead of returning a demo value.
  return {
    text: typeof fileData === 'string' ? fileData : String(fileData),
    metadata: {},
  };
}

/**
 * generateRiskAnalysis
 * - Stub that returns a demo GeminiResponse; replace with real model call.
 */
export async function generateRiskAnalysis(loanData: any): Promise<GeminiResponse> {
  return {
    summary: `${DEMO_PREFIX} Risk analysis placeholder for loanData: ${JSON.stringify(loanData)}`,
    raw: { provided: loanData },
  };
}

/**
 * checkAreaValuation
 * - Stub returning a demo area valuation summary.
 */
export async function checkAreaValuation(addressOrLocation: string): Promise<GeminiResponse> {
  return {
    summary: `${DEMO_PREFIX} Area valuation placeholder for ${addressOrLocation}`,
    raw: { location: addressOrLocation },
  };
}

/**
 * askUnderwriterAI
 * - Stub that returns a canned answer for underwriter questions.
 */
export async function askUnderwriterAI(question: string, context?: any): Promise<GeminiResponse> {
  return {
    summary: `${DEMO_PREFIX} Answer to: ${question}`,
    raw: { contextProvided: context ?? null },
  };
}

/**
 * Backwards-compatible default export
 */
export async function getRiskReport(prompt: string): Promise<GeminiResponse> {
  return generateRiskAnalysis({ prompt });
}

export default getRiskReport;
