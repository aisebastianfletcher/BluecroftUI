import jsPDF from 'jspdf';
import { LoanData, CalculatedMetrics, RiskReport } from '../types';

export const generatePDFReport = async (loanData: LoanData, metrics: CalculatedMetrics, riskReport: RiskReport) => {
  const doc = new jsPDF();
  doc.text(`Underwriting Memo - ${loanData.applicants[0]?.name}`, 20, 20);
  doc.text(`Loan Amount: ${loanData.loanAmount}`, 20, 30);
  doc.text(`Risk Score: ${riskReport.score}`, 20, 40);
  doc.save('Memo.pdf');
};

export const generateRequestLetter = (loanData: LoanData, items: string | string[]) => {
  alert("Generated Request Letter (Demo)");
};

export const generateCalendarEvent = (title: string, description: string, date?: Date) => {
  alert("Calendar Event Created (Demo)");
};
