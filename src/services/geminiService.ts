import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { LoanData, CalculatedMetrics, RiskReport, AreaValuation, UploadedFile } from "../types";

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
console.log("DEBUG: Key Length is", API_KEY.length); 

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Improved JSON Cleaner: Finds the actual JSON object inside any text the AI babbles
const extractJSON = (text: string) => {
  try {
    // 1. Try standard cleaning
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // 2. If that fails, look for the first '{' and last '}'
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      clean = clean.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error on text:", text);
    throw new Error("Failed to parse AI response");
  }
};

/**
 * 1. PARSE DOCUMENT (Aggressive Extraction)
 */
export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  if (!genAI || files.length === 0) {
    console.warn("No API Key or No Files provided for parsing.");
    return {};
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fileParts: Part[] = files.map(file => ({
      inlineData: {
        data: file.data,
        mimeType: file.type,
      },
    }));

    const prompt = `
      You are a Data Entry Specialist for a bank. 
      Analyze the attached images/PDFs (Application Forms, Bank Statements, Accounts).
      
      Extract ALL available financial data. If a field is missing, estimate it based on context or use 0.
      
      CRITICAL: Return ONLY a valid JSON object matching this structure exactly:
      {
        "applicants": [{
          "name": "Full Name",
          "annualIncome": 123456 (number),
          "monthlyExpenses": 1234 (number),
          "totalAssets": 1234567 (number),
          "totalLiabilities": 123456 (number)
        }],
        "loanAmount": 123456 (number),
        "propertyValue": 123456 (number),
        "purchasePrice": 123456 (number),
        "refurbCost": 123456 (number),
        "propertyAddress": "Full Property Address",
        "loanType": "Bridging" (or "Refurbishment")
      }
      
      - If there are joint applicants, include both in the array.
      - Look closely for "Assets" and "Liabilities" summaries.
      - Do not include markdown formatting.
    `;

    const result = await model.generateContent([prompt, ...fileParts]);
    const parsed = extractJSON(result.response.text());
    
    console.log("Document Data Extracted:", parsed);
    return parsed;

  } catch (error) {
    console.error("Parsing failed:", error);
    return {};
  }
};

/**
 * 2. AREA VALUATION (The "Zoopla" Simulator)
 */
export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  if (!genAI) return { summary: "API Key Missing. Please configure VITE_GEMINI_API_KEY in AWS.", estimatedValue: 0, confidence: 0 };

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      Act as a RICS Surveyor and Market Analyst.
      Perform a desktop market valuation for: "${address}".
      
      You must simulate a "Zoopla" or "Rightmove" area report.
      
      Return a JSON object with:
      1. "summary": A detailed market commentary (approx 100 words). MUST include:
         - Recent sold price examples in this postcode (simulate specific addresses/prices).
         - Average £ per sq ft for the area.
         - Market liquidity (Hot/Cold).
         - Demand profile (Families/Professionals/Investors).
      2. "estimatedValue": Your estimated Open Market Value (number).
      3. "confidence": A float between 0.1 and 1.0 (based on how precise the address is).
      
      JSON Only. No markdown.
    `;

    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text());

  } catch (error) {
    console.error("Valuation failed:", error);
    return { 
      summary: "Unable to retrieve market data. Please verify the address.", 
      estimatedValue: 0, 
      confidence: 0 
    };
  }
};

/**
 * 3. RISK ANALYSIS (Detailed Action Plan)
 */
export const generateRiskAnalysis = async (loanData: LoanData, metrics: CalculatedMetrics): Promise<RiskReport> => {
  if (!genAI) return { score: 0, summary: "API Key Missing", risks: [], mitigations: [], nextSteps: [] };

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Act as a Senior Credit Underwriter. Analyze this Bridging Loan.
      
      Data:
      - Address: ${loanData.propertyAddress}
      - Loan: £${loanData.loanAmount}
      - Value: £${loanData.propertyValue} (LTV: ${metrics.ltv.toFixed(2)}%)
      - Exit: ${loanData.exitStrategy}
      - Applicant Income: £${loanData.applicants[0]?.annualIncome || 0}
      
      Return a JSON object:
      {
        "score": number (0-100),
        "summary": "Strict underwriting memo style. Comment on LTV, Security, and Exit.",
        "risks": ["Risk 1", "Risk 2", "Risk 3", "Risk 4"],
        "mitigations": ["Mitigation 1", "Mitigation 2", "Mitigation 3"],
        "nextSteps": [
          "Detailed Condition 1 (e.g. 'Subject to RICS Red Book Valuation')",
          "Detailed Condition 2 (e.g. 'Evidence of Source of Funds')",
          "Detailed Condition 3 (e.g. 'Solicitor confirmation of title')",
          "Detailed Condition 4",
          "Detailed Condition 5",
          "Detailed Condition 6"
        ]
      }
      
      Make the "nextSteps" very specific to UK bridging finance (e.g., mention PG's, Debentures, Building Regs).
    `;

    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text());

  } catch (error) {
    console.error("Risk Analysis failed:", error);
    return { score: 0, summary: "Analysis Failed", risks: [], mitigations: [], nextSteps: [] };
  }
};

/**
 * 4. CHAT ASSISTANT
 */
export const askUnderwriterAI = async (question: string, loanData: LoanData, metrics: CalculatedMetrics | null, riskReport: RiskReport | null, fileNames: string[]): Promise<string> => {
  if (!genAI) return "I am in Demo Mode. Add an API Key to chat with me!";
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const context = `
      System: You are an expert Underwriter.
      Context: Property at ${loanData.propertyAddress}. Loan £${loanData.loanAmount}.
      User Question: ${question}
    `;
    const result = await model.generateContent(context);
    return result.response.text();
  } catch (e: any) { 
    console.error("Gemini Chat Error:", e); // This prints the real error to your browser console
    return `Error: ${e.message || "Connection failed"}`; 
  }
};
