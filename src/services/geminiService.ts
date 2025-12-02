import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// ✅ USE THIS MODEL. It is the latest stable version verified to work with the new SDK.
// (Avoid "gemini-2.0-pro" as it likely doesn't exist publicly yet)
const MODEL_NAME = "gemini-1.5-flash"; 

// Helper: robust JSON extraction from AI responses
const extractJSON = (text: string) => {
  try {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) clean = clean.substring(firstOpen, lastClose + 1);
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return null;
  }
};

/**
 * 1. PARSE DOCUMENT
 */
export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  if (!genAI || files.length === 0) return {};

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const fileParts: Part[] = files.map(file => ({
      inlineData: { data: file.data, mimeType: file.type },
    }));

    const prompt = `
      Extract financial data from these documents into strict JSON.
      Fields: applicants (name, annualIncome, monthlyExpenses, totalAssets, totalLiabilities), loanAmount, propertyValue, propertyAddress, loanType.
      Return JSON ONLY. No markdown.
    `;

    const result = await model.generateContent([prompt, ...fileParts]);
    return extractJSON(result.response.text()) || {};
  } catch (error) {
    console.error("AI Parse Failed:", error);
    return {};
  }
};

/**
 * 2. AREA VALUATION
 */
export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  if (!genAI) return { summary: "API Key Missing", estimatedValue: 0, confidence: 0 };

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `
      Act as a UK Surveyor. Analyze market for: "${address}".
      Return JSON: { "summary": "Detailed commentary...", "estimatedValue": number, "confidence": number }
      JSON Only.
    `;
    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text()) || { summary: "Valuation failed", estimatedValue: 0, confidence: 0 };
  } catch (error) {
    console.error("Area Valuation Failed:", error);
    return { summary: "Valuation Error", estimatedValue: 0, confidence: 0 };
  }
};

/**
 * 3. RISK ANALYSIS
 */
export const generateRiskAnalysis = async (loanData: LoanData, metrics: CalculatedMetrics): Promise<RiskReport> => {
  if (!genAI) return { score: 0, summary: "API Key Missing", risks: [], mitigations: [], nextSteps: [] };

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `
      Act as a Credit Underwriter. Analyze Loan: £${loanData.loanAmount}, LTV: ${metrics.ltv.toFixed(1)}%.
      Return JSON: { "score": number, "summary": "Memo...", "risks": [], "mitigations": [], "nextSteps": [] }
      JSON Only.
    `;
    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text()) || { score: 0, summary: "Analysis failed", risks: [], mitigations: [], nextSteps: [] };
  } catch (error) {
    console.error("Risk Analysis Failed:", error);
    return { score: 0, summary: "Analysis Error", risks: [], mitigations: [], nextSteps: [] };
  }
};

/**
 * 4. CHAT ASSISTANT
 * (Arguments updated to match App.tsx so the AI isn't 'blind' to the risk report)
 */
export const askUnderwriterAI = async (
  question: string, 
  loanData: LoanData, 
  metrics: CalculatedMetrics | null, 
  riskReport: RiskReport | null, 
  fileNames: string[]
): Promise<string> => {
  if (!genAI) return "Demo Mode: API Key missing.";

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    // We include metrics and risk score in the prompt so the AI answers intelligently
    const context = `
      System: You are an expert UK Underwriter.
      Context: 
      - Property: ${loanData.propertyAddress}
      - Loan: £${loanData.loanAmount}
      - LTV: ${metrics ? metrics.ltv.toFixed(2) + "%" : "N/A"}
      - Risk Score: ${riskReport ? riskReport.score : "N/A"}
      
      User Question: ${question}
    `;
    
    const result = await model.generateContent(context);
    return result.response.text();
  } catch (e: any) {
    console.error("Gemini Chat Error:", e);
    return `Error: ${e.message || "Connection failed"}`;
  }
};
