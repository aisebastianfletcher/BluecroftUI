/**
 * Gemini service stubs for build-time completeness.
 * Exports the named functions used by App.tsx:
 *  - parseDocument
 *  - generateRiskAnalysis
 *  - checkAreaValuation
 *  - askUnderwriterAI
 *
 * Replace the stub implementations with your actual @google/genai/Gemini integration.
 */

export interface GeminiResponse {
  summary: string;
  raw?: any;
}

export interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

export async function parseDocument(fileData: string): Promise<ParsedDocument> {
  // Stub: in production, parse the uploaded file (OCR/structure) or extract text
  return {
    text: typeof fileData === 'string' ? fileData : '',
    metadata: {},
  };
}

export async function generateRiskAnalysis(loanData: any): Promise<GeminiResponse> {
  // Stub: call Gemini/TextServiceClient here to produce a risk summary
  return {
    summary: 'Demo risk analysis. Replace with real Gemini response.',
    raw: { loanDataProvided: loanData },
  };
}

export async function checkAreaValuation(addressOrLocation: string): Promise<GeminiResponse> {
  // Stub: use a valuation API or LLM to summarize area valuation
  return {
    summary: `Demo area valuation for ${addressOrLocation}`,
    raw: null,
  };
}

export async function askUnderwriterAI(question: string, context?: any): Promise<GeminiResponse> {
  // Stub: use Gemini to ask underwriting questions
  return {
    summary: `Demo answer to: ${question}`,
    raw: { contextProvided: context },
  };
}

/**
 * Backwards-compatible default export: alias to generateRiskAnalysis.
 */
export async function getRiskReport(prompt: string): Promise<GeminiResponse> {
  return generateRiskAnalysis({ prompt });
}

export default getRiskReport;
