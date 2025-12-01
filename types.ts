

export interface Applicant {
  id: string;
  name: string;
  annualIncome: number;
  monthlyExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface LoanData {
  id?: string;
  applicants: Applicant[];
  loanAmount: number;
  propertyValue: number;
  purchasePrice: number;
  refurbCost: number;
  interestRateMonthly: number;
  termMonths: number;
  loanType: LoanType;
  propertyAddress: string;
  exitStrategy: ExitStrategy;
  scheduledDate?: Date;
  taskDueDates?: Record<string, string>;
}

export enum LoanType {
  BRIDGING = 'Bridging',
  DEVELOPMENT = 'Development',
  REFURBISHMENT = 'Refurbishment'
}

export enum ExitStrategy {
  SALE = 'Sale of Property',
  REFINANCE = 'Refinance to Term Loan',
  DEVELOPMENT_EXIT = 'Development Exit Finance',
  CASH_SETTLEMENT = 'Cash Settlement',
  OTHER = 'Other'
}

export interface CalculatedMetrics {
  ltv: number; // Loan to Value
  ltc: number; // Loan to Cost
  monthlyInterest: number;
  totalInterest: number;
  grossLoan: number;
}

export interface RiskReport {
  score: number; // 0-100
  summary: string;
  risks: string[];
  mitigations: string[];
  nextSteps: string[]; // Actionable items for the employee
}

export interface AreaValuation {
  summary: string;
  sources: { title: string; uri: string }[];
}

// --- New Types for Advanced Features ---

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string; // e.g. "Underwriter"
  details: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface UploadedFile {
  name: string;
  type: string;
  data: string; // Base64
}

export interface CaseRecord {
  id: string;
  loanData: LoanData;
  metrics: CalculatedMetrics;
  riskReport: RiskReport;
  completedTasks: Set<string>;
  createdAt: Date;
  scheduledDate?: Date;
}