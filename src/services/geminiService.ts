import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

// Initialize Gemini
// Ensure your VITE_GEMINI_API_KEY is set in your environment variables on AWS Amplify
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Helper to clean Markdown JSON blocks (```json ... ```)
const cleanJSON = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * 1. PARSE DOCUMENT (Real Extraction)
 * Sends images/PDFs to Gemini Flash to extract Applicant & Loan info.
 */
export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  if (!genAI || files.length === 0) return {};

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert uploaded files to Gemini "Parts"
    const fileParts: Part[] = files.map(file => ({
      inlineData: {
        data: file.data, // Base64 string
        mimeType: file.type,
      },
    }));

    const prompt = `
      Analyze these financial documents (Application forms, Bank Statements, or accounts).
      Extract the following data into a strict JSON format. 
      If a value is not found, use 0 or empty string. Do not invent data.
      
      Structure:
      {
        "applicants": [{
          "name": "Full Name or Company Name",
          "annualIncome": number,
          "monthlyExpenses": number,
          "totalAssets": number,
          "totalLiabilities": number
        }],
        "loanAmount": number,
        "propertyValue": number,
        "purchasePrice": number,
        "refurbCost": number,
        "propertyAddress": "Full address including postcode",
        "loanType": "Bridging" | "Refurbishment" | "Development"
      }
      
      If there are multiple people, add them to the applicants array.
      Sum up assets/liabilities from Statements of Assets & Liabilities if visible.
    `;

    const result = await model.generateContent([prompt, ...fileParts]);
    const response = await result.response;
    const text = response.text();
    
    const parsed = JSON.parse(cleanJSON(text));
    console.log("AI Extraction Result:", parsed);
    return parsed;

  } catch (error) {
    console.error("Document parsing failed:", error);
    // Return empty if failed so the app doesn't crash
    return {};
  }
};

/**
 * 2. AREA VALUATION (Simulated Zoopla/Market Search)
 * Asks Gemini to act as a surveyor/market analyst.
 */
export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  if (!genAI) {
    return { summary: "AI API Key missing. Cannot analyze area.", estimatedValue: 0, confidence: 0 };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      Act as a UK Property Surveyor and Market Analyst.
      Perform a desktop valuation analysis for: "${address}".
      
      Provide a JSON response with:
      1. "summary": A detailed paragraph mentioning recent sold prices in the postcode (simulate Zoopla/Rightmove data), market liquidity, and demand for refurbishment projects in this specific area. Be specific about the location characteristics.
      2. "estimatedValue": An estimated OMV (Open Market Value) in GBP (number).
      3. "confidence": A score from 0.0 to 1.0 based on how specific the address is.
      
      JSON Format: { "summary": string, "estimatedValue": number, "confidence": number }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(cleanJSON(text));

  } catch (error) {
    console.error("Area search failed:", error);
    return { 
      summary: "Could not retrieve market data at this time.", 
      estimatedValue: 0, 
      confidence: 0 
    };
  }
};

/**
 * 3. RISK ANALYSIS (Detailed Underwriting)
 * Generates the full report, score, and action plan.
 */
export const generateRiskAnalysis = async (
  loanData: LoanData, 
  metrics: CalculatedMetrics
): Promise<RiskReport> => {
  if (!genAI) {
    return {
      score: 0,
      summary: "API Key Missing",
      risks: [],
      mitigations: [],
      nextSteps: []
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Act as a Senior Credit Underwriter for a Bridging Finance lender.
      Analyze this loan application:

      Address: ${loanData.propertyAddress}
      Loan Amount: £${loanData.loanAmount}
      Value: £${loanData.propertyValue} (LTV: ${metrics.ltv.toFixed(2)}%)
      Purchase Price: £${loanData.purchasePrice}
      Refurb Cost: £${loanData.refurbCost}
      Loan Type: ${loanData.loanType}
      Exit Strategy: ${loanData.exitStrategy}
      
      Applicants: ${JSON.stringify(loanData.applicants)}

      Provide a strict JSON Risk Report:
      {
        "score": number (0-100, where 100 is safe, <50 is critical risk),
        "summary": "Professional underwriting memo style summary. Discuss the LTV, the viability of the exit strategy, and the applicant's strength.",
        "risks": ["List 3-5 specific risks (e.g. market exposure, heavy refurb complexity, tight exit timeline)"],
        "mitigations": ["List 3-5 specific mitigations (e.g. low LTV, PG signed, retained interest)"],
        "nextSteps": [
           "List 5-7 very specific underwriting conditions or tasks.",
           "Example: 'Obtain RICS Red Book Valuation'",
           "Example: 'Verify Source of Funds for £80k deposit'",
           "Example: 'Check exit route viability via comparable sales'"
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(cleanJSON(text));

  } catch (error) {
    console.error("Risk analysis failed:", error);
    return {
      score: 50,
      summary: "AI Analysis failed to generate. Please check inputs.",
      risks: ["System Error"],
      mitigations: [],
      nextSteps: ["Retry Analysis"]
    };
  }
};

/**
 * 4. CHAT ASSISTANT
 */
export const askUnderwriterAI = async (
  question: string, 
  loanData: LoanData, 
  metrics: CalculatedMetrics | null, 
  riskReport: RiskReport | null,
  fileNames: string[]
): Promise<string> => {
  if (!genAI) return "I cannot answer without an API Key.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const context = `
      You are an AI Underwriting Assistant.
      Current Case:
      - Property: ${loanData.propertyAddress}
      - Loan: £${loanData.loanAmount}
      - LTV: ${metrics?.ltv.toFixed(1)}%
      - Risk Score: ${riskReport?.score}
      - Documents: ${fileNames.join(", ")}
      
      User Question: "${question}"
      
      Answer briefly and professionally as a colleague.
    `;

    const result = await model.generateContent(context);
    return result.response.text();
  } catch (error) {
    return "Sorry, I am having trouble connecting to the brain right now.";
  }
};
