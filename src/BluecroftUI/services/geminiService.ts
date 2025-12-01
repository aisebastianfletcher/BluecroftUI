/**
 * Lightweight stub for Gemini calls.
 * Place this file at: src/BluecroftUI/services/geminiService.ts
 *
 * This stub satisfies the import used by src/BluecroftUI/App.tsx and prevents the Vite build error.
 * Replace the implementation with real @google/genai/Gemini calls when you're ready.
 */

export interface GeminiResponse {
  summary: string;
  raw?: any;
}

/**
 * getRiskReport
 * Simple placeholder function that returns a demo report.
 * Replace with a real API call to @google/genai / Gemini when available.
 */
export async function getRiskReport(prompt: string): Promise<GeminiResponse> {
  const apiKey = (process.env.GEMINI_API_KEY as string | undefined);

  if (!apiKey) {
    // Running in demo mode; don't attempt network calls
    return {
      summary: 'Gemini API key not available — running in demo mode.',
      raw: { promptProvided: prompt },
    };
  }

  // TODO: Implement real Gemini client usage here.
  return {
    summary: 'Demo risk report generated (replace with real Gemini integration).',
    raw: { promptProvided: prompt },
  };
}

// Default export to match either default or named import styles.
export default getRiskReport;
