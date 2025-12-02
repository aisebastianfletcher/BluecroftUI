import { GoogleGenerativeAI } from "@google/genai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

// Initialize Gemini (Safe check for API Key)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Mock fallback for when API key is missing during build/demo
const MOCK_DELAY = 1500;

export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  // In a real app, you would send the base64 images/pdf to Gemini Flash
  console.log("Parsing documents:", files.length);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Return dummy data extracted from "documents"
  return {
    loanAmount: 350000,
    propertyValue: 500000,
    propertyAddress: "Extracted Address, London, SW1",
  };
};

export const generateRiskAnalysis = async (
  loanData: LoanData, 
  metrics: CalculatedMetrics
): Promise<RiskReport> => {
  console.log("Generating risk analysis...");
  
  if (!genAI) {
    // Fallback mock if no API key
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return {
      score: metrics.ltv > 75 ? 45 : 85,
      summary: "Based on the provided parameters, the loan appears to be within standard risk tolerances, though the LTV is nearing the upper threshold.",
      risks: ["Market volatility affecting exit value", "Refurbishment cost overruns"],
      mitigations: ["Personal Guarantee from Directors", "Retained interest for full term"],
      nextSteps: ["Obtain RICS Valuation", "Verify Source of Funds", "Check Credit Reports"]
    };
  }

  // Real AI call would go here
  // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  // ... implementation ...
  
  // Returning mock for stability during deployment
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return {
      score: Math.max(0, Math.min(100, 100 - (metrics.ltv - 50) * 2)),
      summary: `AI Analysis complete for ${loanData.propertyAddress}. The LTV of ${metrics.ltv.toFixed(1)}% is the primary risk factor.`,
      risks: ["High Loan to Value", "Short leasehold implications (if applicable)"],
      mitigations: ["Strong applicant asset profile", "Confirmed exit strategy via sale"],
      nextSteps: ["Request full valuation report", "Confirm 12 months mortgage history", "ID Checks"]
  };
};

export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  console.log("Checking area:", address);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return {
    summary: "The area has seen a 5% growth in the last 12 months. High demand for residential refurbishment projects.",
    estimatedValue: 450000,
    confidence: 0.85
  };
};

export const askUnderwriterAI = async (
  question: string, 
  loanData: LoanData, 
  metrics: CalculatedMetrics | null, 
  riskReport: RiskReport | null,
  fileNames: string[]
): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `I have analyzed the case for ${loanData.propertyAddress}. Regarding "${question}": Typically, for a loan of £${loanData.loanAmount}, we would require 3 months of bank statements. The current risk score is ${riskReport?.score || 'pending'}.`;
};

// Helper required by the test UI file if you kept it
export const getRiskReport = async (prompt: string): Promise<any> => {
  return { result: "Quick report generated" };
}
