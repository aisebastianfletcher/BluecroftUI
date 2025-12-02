import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Use the specific stable model that triggers the v1 API
// You can change this to "models/gemini-1.5-pro-002" if you want the smarter/slower model
const MODEL_NAME = "models/gemini-1.5-flash-002";

// Helper: robustly find JSON in AI response
const extractJSON = (text: string) => {
  try {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      clean = clean.substring(firstOpen, lastClose + 1);
    }
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
  if (!genAI) {
    alert("API Key missing. Using Demo Data.");
    return getMockParseData();
  }

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
    const parsed = extractJSON(result.response.text());
    return parsed || getMockParseData();

  } catch (error) {
    console.error("AI Parse Failed:", error);
    return getMockParseData();
  }
};

/**
 * 2. AREA VALUATION
 */
export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  if (!genAI) return getMockValuation(address);

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `
      Act as a UK Surveyor. Analyze market for: "${address}".
      Return JSON: { "summary": "Detailed commentary...", "estimatedValue": number, "confidence": number }
      JSON Only.
    `;
    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text()) || getMockValuation(address);
  } catch (error) {
    return getMockValuation(address);
  }
};

/**
 * 3. RISK ANALYSIS
 */
export const generateRiskAnalysis = async (loanData: LoanData, metrics: CalculatedMetrics): Promise<RiskReport> => {
  if (!genAI) return getMockRiskReport(metrics);

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `
      Act as a Credit Underwriter. Analyze Loan: £${loanData.loanAmount}, LTV: ${metrics.ltv.toFixed(1)}%.
      Return JSON: { "score": number, "summary": "Memo...", "risks": [], "mitigations": [], "nextSteps": [] }
      JSON Only.
    `;
    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text()) || getMockRiskReport(metrics);
  } catch (error) {
    return getMockRiskReport(metrics);
  }
};

/**
 * 4. CHAT ASSISTANT
 */
export const askUnderwriterAI = async (question: string, loanData: LoanData, metrics: CalculatedMetrics | null, riskReport: RiskReport | null, fileNames: string[]): Promise<string> => {
  if (!genAI) return "I am in Demo Mode. Add an API Key to chat with me!";
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const context = `
      System: You are an expert Underwriter using Gemini 1.5.
      Context: Property at ${loanData.propertyAddress}. Loan £${loanData.loanAmount}.
      User Question: ${question}
    `;
    
    const result = await model.generateContent(context);
    return result.response.text();
  } catch (e: any) { 
    console.error("Gemini Chat Error:", e);
    return `Error: ${e.message || "Connection failed"}`; 
  }
};

// --- MOCK DATA FALLBACKS ---
const getMockParseData = (): Partial<LoanData> => ({
  applicants: [{ id: "mock-1", name: "Demo Applicant", annualIncome: 100000, monthlyExpenses: 2000, totalAssets: 500000, totalLiabilities: 100000 }],
  propertyAddress: "22 Demo Lane, London",
  loanAmount: 250000, propertyValue: 400000
});
const getMockValuation = (address: string): AreaValuation => ({ summary: `(Demo) Market analysis for ${address}...`, estimatedValue: 500000, confidence: 0.8 });
const getMockRiskReport = (metrics: CalculatedMetrics): RiskReport => ({ score: 75, summary: "(Demo) Standard risk report...", risks: ["Demo Risk"], mitigations: ["Demo Mitigation"], nextSteps: ["Demo Step"] });
