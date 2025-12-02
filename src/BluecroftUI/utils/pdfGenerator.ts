import jsPDF from 'jspdf';
import { LoanData, CalculatedMetrics, RiskReport } from '../types';

export const generatePDFReport = async (
  loanData: LoanData, 
  metrics: CalculatedMetrics, 
  riskReport: RiskReport
) => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text("Blue Croft Finance - Underwriting Memo", 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Applicant: ${loanData.applicants[0]?.name}`, 20, 40);
  doc.text(`Property: ${loanData.propertyAddress}`, 20, 50);
  doc.text(`Loan Amount: £${loanData.loanAmount.toLocaleString()}`, 20, 60);
  
  doc.text(`Risk Score: ${riskReport.score}/100`, 20, 80);
  doc.text(`LTV: ${metrics.ltv.toFixed(2)}%`, 20, 90);
  
  doc.text("Summary:", 20, 110);
  const splitSummary = doc.splitTextToSize(riskReport.summary, 170);
  doc.text(splitSummary, 20, 120);

  doc.save(`Memo-${loanData.applicants[0]?.name || 'Client'}.pdf`);
};

export const generateRequestLetter = (
  loanData: LoanData, 
  items: string | string[]
) => {
  const itemList = Array.isArray(items) ? items.join(", ") : items;
  alert(`[DEMO] Generated Request Letter for:\n\n${itemList}\n\nSent to: ${loanData.applicants[0]?.name}`);
};

export const generateCalendarEvent = (
  title: string, 
  description: string, 
  date?: Date
) => {
  const d = date || new Date();
  alert(`[DEMO] Calendar Event Created:\n\nTitle: ${title}\nDesc: ${description}\nDate: ${d.toLocaleDateString()}`);
};
