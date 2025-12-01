
import { GoogleGenAI, Type } from "@google/genai";
import { LoanData, LoanType, ExitStrategy, RiskReport, AreaValuation, UploadedFile, CalculatedMetrics, Applicant } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION_PARSER = `You are a specialized document extraction AI for Blue Croft Finance. 
Your job is to extract loan application details from documents (PDFs, images) accurately. 
You are capable of performing OCR on scanned documents and images.
You may receive multiple files (e.g., Application Form, Bank Statements, Credit Report). Consolidate the information.
Identify ALL applicants involved.
If a field is not found, make a reasonable estimate based on context or return 0/empty string.
Always return JSON.`;

const SYSTEM_INSTRUCTION_UNDERWRITER = `You are a senior credit underwriter at Blue Croft Finance. 
Analyze the provided loan metrics and data. Provide a professional, risk-averse assessment. 
Focus strictly on the viability of the Exit Strategy. 
If the exit is 'Refinance', critically assess if the aggregated income supports it.
If the exit is 'Sale', assess the LTV buffer.

You MUST also provide a specific list of 'nextSteps' for the case manager/employee. 
These steps should explicitly include:
1. Requesting information on existing loans (if any).
2. Performing Credit Bureau searches (Credit Score/History).
3. Conducting Bankruptcy & Insolvency searches.
4. Specific document requests relevant to this specific deal (e.g., Schedule of Works, Proof of Funds, Valuation Report).`;

// Helper to ensure data integrity
const sanitizeParsedData = (data: any): Partial<LoanData> => {
  const safeData: any = { ...data };
  
  // Ensure applicants is an array
  if (!safeData.applicants || !Array.isArray(safeData.applicants)) {
    safeData.applicants = [];
  }

  // Ensure numeric fields are numbers (not null/strings)
  const numFields = ['loanAmount', 'propertyValue', 'purchasePrice', 'refurbCost', 'interestRateMonthly', 'termMonths'];
  numFields.forEach(field => {
    safeData[field] = typeof safeData[field] === 'number' ? safeData[field] : 0;
  });

  // Sanitize applicants
  safeData.applicants = safeData.applicants.map((app: any) => ({
    name: app.name || '',
    annualIncome: typeof app.annualIncome === 'number' ? app.annualIncome : 0,
    monthlyExpenses: typeof app.monthlyExpenses === 'number' ? app.monthlyExpenses : 0,
    totalAssets: typeof app.totalAssets === 'number' ? app.totalAssets : 0,
    totalLiabilities: typeof app.totalLiabilities === 'number' ? app.totalLiabilities : 0
  }));

  return safeData;
};

// Helper to sanitize Risk Report to prevent UI Crashes
const sanitizeRiskReport = (data: any): RiskReport => {
  return {
    score: typeof data.score === 'number' ? data.score : 50,
    summary: typeof data.summary === 'string' ? data.summary : "No summary provided.",
    risks: Array.isArray(data.risks) ? data.risks : [],
    mitigations: Array.isArray(data.mitigations) ? data.mitigations : [],
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : []
  };
};

/**
 * Parses multiple base64 documents to extract LoanData
 */
export const parseDocument = async (files: UploadedFile[]): Promise<Partial<LoanData>> => {
  try {
    const parts = files.map(file => ({
      inlineData: {
        mimeType: file.type,
        data: file.data,
      },
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          ...parts,
          {
            text: `Extract the following fields from these documents (perform OCR if needed). 
            Consolidate data if multiple files are provided.
            Fields: 
            - Applicants: Array of objects containing Name, Annual Income, Monthly Expenses, Total Assets, Total Liabilities for each person/entity.
            - Loan Details: Loan Amount, Property Value, Purchase Price, Refurb Cost, Monthly Interest Rate, Term, Property Address, Loan Type (Bridging/Development/Refurbishment), Exit Strategy.`,
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PARSER,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            applicants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  annualIncome: { type: Type.NUMBER },
                  monthlyExpenses: { type: Type.NUMBER },
                  totalAssets: { type: Type.NUMBER },
                  totalLiabilities: { type: Type.NUMBER }
                }
              }
            },
            loanAmount: { type: Type.NUMBER },
            propertyValue: { type: Type.NUMBER },
            purchasePrice: { type: Type.NUMBER },
            refurbCost: { type: Type.NUMBER },
            interestRateMonthly: { type: Type.NUMBER },
            termMonths: { type: Type.NUMBER },
            propertyAddress: { type: Type.STRING },
            loanType: { type: Type.STRING, enum: [LoanType.BRIDGING, LoanType.DEVELOPMENT, LoanType.REFURBISHMENT] },
            exitStrategy: { type: Type.STRING, enum: [ExitStrategy.SALE, ExitStrategy.REFINANCE, ExitStrategy.DEVELOPMENT_EXIT, ExitStrategy.CASH_SETTLEMENT, ExitStrategy.OTHER] }
          },
          required: ["loanAmount", "propertyValue"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const rawData = JSON.parse(text);
    return sanitizeParsedData(rawData);
  } catch (error) {
    console.error("Error parsing document:", error);
    throw error;
  }
};

/**
 * Checks area valuation using Google Search Grounding
 */
export const checkAreaValuation = async (address: string): Promise<AreaValuation> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for the average property prices and recent sold prices in the area of: ${address}. 
      Provide a concise summary of the local property market values, mentioning typical price ranges for similar properties if possible.`,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType is NOT allowed with googleSearch
      },
    });

    const summary = response.text || "No summary available.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Extract sources with explicit typing
    const sources: { title: string; uri: string }[] = chunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web !== undefined)
      .map((web: any) => ({ 
        title: (web.title as string) || "Source", 
        uri: (web.uri as string) || "#" 
      }));

    // Deduplicate sources by URI
    const uniqueSources = Array.from(
      new Map<string, { title: string; uri: string }>(
        sources.map((item) => [item.uri, item])
      ).values()
    );

    return { summary, sources: uniqueSources };
  } catch (error) {
    console.error("Error checking area valuation:", error);
    return {
      summary: "Could not retrieve local market data at this time.",
      sources: []
    };
  }
};

/**
 * Generates a risk report based on current loan data
 */
export const generateRiskAnalysis = async (data: LoanData, metrics: any): Promise<RiskReport> => {
  try {
    // Aggregate financials safely (handle missing applicants/arrays)
    const safeApplicants = Array.isArray(data.applicants) ? data.applicants : [];
    
    const totalIncome = safeApplicants.reduce((sum, app) => sum + (app?.annualIncome || 0), 0);
    const totalExpenses = safeApplicants.reduce((sum, app) => sum + (app?.monthlyExpenses || 0), 0);
    const totalAssets = safeApplicants.reduce((sum, app) => sum + (app?.totalAssets || 0), 0);
    const totalLiabilities = safeApplicants.reduce((sum, app) => sum + (app?.totalLiabilities || 0), 0);
    const applicantNames = safeApplicants.map(a => a?.name || 'Unknown').join(', ');

    const prompt = `
      Analyze this bridging loan application:
      
      -- Loan Details --
      Applicants: ${applicantNames}
      Loan Amount: ${data.loanAmount || 0}
      LTV: ${metrics?.ltv?.toFixed(2) || 0}%
      Loan Type: ${data.loanType}
      
      -- Exit Strategy --
      Strategy: ${data.exitStrategy}
      Term: ${data.termMonths || 0} months
      
      -- Consolidated Financial Profile (All Applicants) --
      Total Annual Income: ${totalIncome}
      Total Monthly Expenses: ${totalExpenses}
      Net Asset Position: ${totalAssets - totalLiabilities}
      
      -- Metrics --
      Gross Loan: ${metrics?.grossLoan || 0}
      
      Provide a risk score (0-100), a summary focusing on the Exit Strategy, 3 key risks, 3 mitigations, and 4-5 actionable Next Steps for the employee.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_UNDERWRITER,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            mitigations: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text);
    return sanitizeRiskReport(parsed);
  } catch (error) {
    console.error("Error generating risk report:", error);
    // Return a fallback if AI fails to ensure UI doesn't crash
    return {
      score: 50,
      summary: "AI Service temporarily unavailable. Manual underwriting required. (Error: " + (error instanceof Error ? error.message : "Unknown") + ")",
      risks: ["System error during analysis - data may be incomplete"],
      mitigations: ["Perform full manual review"],
      nextSteps: ["Check credit score", "Verify ID", "Request Bank Statements"]
    };
  }
};

/**
 * Contextual Q&A Assistant
 */
export const askUnderwriterAI = async (
  question: string,
  loanData: LoanData,
  metrics: CalculatedMetrics | null,
  riskReport: RiskReport | null,
  fileContext: string[] = [] // Optional: Names of files uploaded
): Promise<string> => {
  try {
    const applicantNames = loanData.applicants ? loanData.applicants.map(a => a.name).join(', ') : 'Unknown';
    const context = `
      You are an AI Assistant for Blue Croft Finance. 
      You are helping an employee analyze a loan.
      
      Current Data:
      - Applicants: ${applicantNames}
      - Loan: ${loanData.loanAmount}
      - Address: ${loanData.propertyAddress}
      - LTV: ${metrics?.ltv.toFixed(2)}%
      - Risk Score: ${riskReport?.score || 'N/A'}
      - Exit: ${loanData.exitStrategy}
      - Next Steps: ${riskReport?.nextSteps?.join(', ') || 'None'}
      - Files Uploaded: ${fileContext.join(', ')}
      
      Previous Analysis Summary: ${riskReport?.summary || 'Not generated yet'}
      
      User Question: "${question}"
      
      Answer concisely and professionally. If the user asks about specific details not in the summary, explain that you are estimating based on the provided fields or suggest where to look.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: context,
    });

    return response.text || "I couldn't generate an answer.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Sorry, I'm having trouble connecting to the AI right now.";
  }
};
