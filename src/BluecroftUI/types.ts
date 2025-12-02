export enum LoanType {
  BRIDGING = 'Bridging',
  REFURBISHMENT = 'Refurbishment',
  DEVELOPMENT = 'Development',
  COMMERCIAL = 'Commercial'
}

export enum ExitStrategy {
  SALE = 'Sale',
  REFINANCE = 'Refinance',
  DEVELOPMENT_EXIT = 'Development Exit'
}

export interface Applicant {
  id: string;
  name: string;
  annualIncome: number;
  monthlyExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface LoanData {
  id: string;
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
  taskDueDates?: Record<string, string>; // ISO Date strings
  createdAt?: Date;
}

export interface CalculatedMetrics {
  ltv: number;
  ltc: number;
  monthlyInterest: number;
  totalInterest: number;
  grossLoan: number;
}

export interface RiskReport {
  score: number;
  summary: string;
  risks: string[];
  mitigations: string[];
  nextSteps: string[];
}

export interface AreaValuation {
  summary: string;
  estimatedValue?: number;
  confidence?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
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
  scheduledDate: Date;
}
