import { GoogleGenerativeAI } from "@google/genai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const MOCK_DELAY = 1000;

export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return {
    loanAmount: 350000,
    propertyValue: 500000,
    propertyAddress: "Extracted Address, London, SW1",
  };
};

export const generateRiskAnalysis = async (loanData: LoanData, metrics: CalculatedMetrics): Promise<RiskReport> => {
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
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return {
    summary: "The area has seen a 5% growth in the last 12 months. High demand for residential refurbishment projects.",
    estimatedValue: 450000,
    confidence: 0.85
  };
};

export const askUnderwriterAI = async (question: string, loanData: LoanData, metrics: CalculatedMetrics | null, riskReport: RiskReport | null, fileNames: string[]): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `I have analyzed the case for ${loanData.propertyAddress}. Regarding "${question}": Typically, for a loan of £${loanData.loanAmount}, we would require 3 months of bank statements.`;
};
