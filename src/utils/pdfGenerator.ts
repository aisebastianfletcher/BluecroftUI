
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { LoanData, CalculatedMetrics, RiskReport } from "../types";

// Helper for branding consistency
const BRAND_COLOR = "#0ea5e9"; // Brand-500
const TEXT_COLOR = "#334155";   // Slate-700

export const generatePDFReport = async (
  loanData: LoanData,
  metrics: CalculatedMetrics,
  riskReport: RiskReport
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Helper for currency
  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  // Helper for risk label
  const getRiskLabel = (s: number) => {
    if (s >= 80) return 'Low Risk (Excellent)';
    if (s >= 60) return 'Moderate Risk (Good)';
    if (s >= 40) return 'High Risk (Caution)';
    return 'Critical Risk';
  };

  // Helper for text wrapping
  const addWrappedText = (text: string, y: number, fontSize: number = 10, font: string = "normal") => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", font);
    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, y);
    return y + (splitText.length * fontSize * 0.45) + 6;
  };

  const getMainApplicantName = (data: LoanData) => {
    return data.applicants.length > 0 && data.applicants[0].name ? data.applicants[0].name : 'Unnamed Applicant';
  };

  let yPos = 20;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(14, 165, 233); // Brand color #0ea5e9
  doc.text("Blue Croft Finance", 20, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Underwriting Memo", pageWidth - 20, yPos, { align: "right" });
  doc.text(new Date().toLocaleDateString(), pageWidth - 20, yPos + 5, { align: "right" });

  yPos += 20;

  // 1. Executive Summary
  doc.setFillColor(240, 249, 255); // brand-50
  doc.setDrawColor(224, 242, 254); // brand-100
  doc.rect(20, yPos - 5, pageWidth - 40, 25, 'FD');
  
  doc.setFontSize(12);
  doc.setTextColor(12, 74, 110); // brand-900
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", 25, yPos + 5);
  yPos += 12;
  
  doc.setTextColor(0);
  yPos = addWrappedText(riskReport.summary, yPos, 10);
  yPos += 10;

  // 2. Loan Details Grid
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Loan Overview", 20, yPos);
  doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
  yPos += 12;

  const applicantNames = loanData.applicants.map(a => a.name).join(', ');

  const details = [
    [`Applicants:`, applicantNames, `Loan Type:`, loanData.loanType],
    [`Address:`, loanData.propertyAddress, `Term:`, `${loanData.termMonths} months`],
    [`Loan Amount:`, fmt(loanData.loanAmount), `Property Value:`, fmt(loanData.propertyValue)],
    [`LTV:`, `${metrics.ltv.toFixed(2)}%`, `Risk Score:`, `${riskReport.score}/100 - ${getRiskLabel(riskReport.score)}`],
    [`Exit Strategy:`, loanData.exitStrategy, `Gross Loan:`, fmt(metrics.grossLoan)]
  ];

  doc.setFontSize(10);
  details.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0], 20, yPos);
    doc.setFont("helvetica", "normal");
    const splitName = doc.splitTextToSize(row[1], 55);
    doc.text(splitName, 55, yPos);
    
    doc.setFont("helvetica", "bold");
    doc.text(row[2], 110, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(row[3], 145, yPos);
    
    // Adjust yPos based on height of wrapped name if needed
    yPos += Math.max(8, splitName.length * 5); 
  });
  
  yPos += 10;

  // 3. Borrower Financials (Iterate Applicants)
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Borrower Financial Profiles", 20, yPos);
  doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
  yPos += 12;
  
  loanData.applicants.forEach((app, idx) => {
      // Check page break
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(14, 165, 233);
      doc.text(`Applicant ${idx + 1}: ${app.name || 'Unnamed'}`, 20, yPos);
      yPos += 8;

      doc.setTextColor(0);
      doc.setFontSize(10);
      const financials = [
        [`Annual Income:`, fmt(app.annualIncome || 0), `Total Assets:`, fmt(app.totalAssets || 0)],
        [`Monthly Expenses:`, fmt(app.monthlyExpenses || 0), `Total Liabilities:`, fmt(app.totalLiabilities || 0)],
      ];

      financials.forEach(row => {
        doc.setFont("helvetica", "bold");
        doc.text(row[0], 25, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(row[1], 60, yPos);
        
        doc.setFont("helvetica", "bold");
        doc.text(row[2], 115, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(row[3], 150, yPos);
        yPos += 6;
      });
      yPos += 6;
  });
  
  // Consolidated Stats
  const totalIncome = loanData.applicants.reduce((sum, a) => sum + (a.annualIncome || 0), 0);
  const totalNetAsset = loanData.applicants.reduce((sum, a) => sum + ((a.totalAssets || 0) - (a.totalLiabilities || 0)), 0);
  
  doc.setFillColor(248, 250, 252);
  doc.rect(20, yPos, pageWidth - 40, 15, 'FD');
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(`Consolidated Net Assets: ${fmt(totalNetAsset)}`, 25, yPos + 10);
  doc.text(`Total Annual Income: ${fmt(totalIncome)}`, 115, yPos + 10);
  
  yPos += 25;


  // 4. Risk Analysis
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Risk Assessment", 20, yPos);
  doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
  yPos += 12;

  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38); // Red
  doc.setFont("helvetica", "bold");
  doc.text("Key Risks:", 20, yPos);
  yPos += 6;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  riskReport.risks.forEach(risk => {
    doc.text(`• ${risk}`, 25, yPos);
    yPos += 6;
  });

  yPos += 5;
  doc.setTextColor(22, 163, 74); // Green
  doc.setFont("helvetica", "bold");
  doc.text("Mitigations:", 20, yPos);
  yPos += 6;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  riskReport.mitigations.forEach(mit => {
    doc.text(`• ${mit}`, 25, yPos);
    yPos += 6;
  });
  
  // 5. Next Steps
  yPos += 5;
  
  // Check page break before starting Next Steps
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(124, 58, 237); // Violet
  doc.text("Action Plan / Next Steps", 20, yPos);
  doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
  yPos += 12;

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  
  if (riskReport.nextSteps && riskReport.nextSteps.length > 0) {
    riskReport.nextSteps.forEach(step => {
       // Check page break inside loop
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`[  ] ${step}`, 25, yPos);
      yPos += 8;
    });
  } else {
    doc.text(`[  ] Perform full credit search`, 25, yPos); yPos += 8;
    doc.text(`[  ] Check bankruptcy register`, 25, yPos); yPos += 8;
    doc.text(`[  ] Request proof of funds`, 25, yPos); yPos += 8;
  }


  // 6. Charts (Capture from DOM)
  // Check if we need a new page
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 20;
  } else {
    yPos += 15;
  }

  const ltvChartEl = document.getElementById('ltv-chart-container');
  const riskGaugeEl = document.getElementById('risk-gauge-container');

  if (ltvChartEl) {
    try {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Financial Visuals", 20, yPos);
      yPos += 10;

      // Capture LTV
      const canvas = await html2canvas(ltvChartEl, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = (pageWidth - 50) / 2;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.addImage(imgData, 'PNG', 20, yPos, pdfWidth, pdfHeight);
      
      // Capture Risk Gauge
      if (riskGaugeEl) {
         const canvas2 = await html2canvas(riskGaugeEl, { scale: 2, useCORS: true });
         const imgData2 = canvas2.toDataURL('image/png');
         const imgProps2 = doc.getImageProperties(imgData2);
         const pdfHeight2 = (imgProps2.height * pdfWidth) / imgProps2.width;
         
         doc.addImage(imgData2, 'PNG', 25 + pdfWidth, yPos, pdfWidth, pdfHeight2);
      }
    } catch (e) {
      console.error("Error capturing charts", e);
    }
  }

  doc.save(`BlueCroft_Memo_${getMainApplicantName(loanData).replace(/\s+/g, '_') || 'Draft'}.pdf`);
};

/**
 * Generates a formal request letter for specific underwriting requirements.
 * Accepts a single request string or an array of requests.
 */
export const generateRequestLetter = (loanData: LoanData, requestItems: string | string[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let yPos = 20;
  const applicantNames = loanData.applicants.map(a => a.name).join(' & ');

  // Header
  doc.setFontSize(24);
  doc.setTextColor(14, 165, 233); // Brand color
  doc.setFont("helvetica", "bold");
  doc.text("Blue Croft Finance", 20, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("123 Financial District, London, UK", 20, yPos + 6);
  doc.text("underwriting@bluecroft.ai", 20, yPos + 11);
  
  doc.text(new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 20, yPos + 11, { align: "right" });

  yPos += 30;

  // Recipient
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`To: ${applicantNames || "The Applicant"}`, 20, yPos);
  if (loanData.propertyAddress) {
     doc.text(`Re: Property at ${loanData.propertyAddress}`, 20, yPos + 6);
  }
  yPos += 20;

  // Subject
  doc.setFont("helvetica", "bold");
  doc.text("SUBJECT: OUTSTANDING INFORMATION REQUEST", 20, yPos);
  doc.line(20, yPos + 2, 120, yPos + 2);
  yPos += 15;

  // Body
  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${applicantNames || "Applicant"},`, 20, yPos);
  yPos += 10;

  const introText = "Thank you for your recent application with Blue Croft Finance. Following an initial review by our underwriting team, we require the following additional information to proceed with your application:";
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 40);
  doc.text(splitIntro, 20, yPos);
  yPos += (splitIntro.length * 5) + 10;

  // The request box dynamic sizing
  const isMulti = Array.isArray(requestItems);
  let boxHeight = 0;
  
  // Calculate required height for the box
  doc.setFontSize(11); 
  doc.setFont("helvetica", "bold"); // Assuming bold inside box
  
  if (isMulti) {
    (requestItems as string[]).forEach(item => {
       const lines = doc.splitTextToSize(item, pageWidth - 60).length;
       boxHeight += (lines * 5) + 4; // line height + padding
    });
    boxHeight += 20; // Top/Bottom padding
  } else {
    const lines = doc.splitTextToSize(requestItems as string, pageWidth - 50).length;
    boxHeight = (lines * 6) + 24;
  }

  // Draw Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(20, yPos, pageWidth - 40, boxHeight, 'FD');
  
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(11);
  
  let currentY = yPos + 12;

  // Render text inside box
  if (isMulti) {
    (requestItems as string[]).forEach(item => {
       // Bullet
       doc.text("•", 25, currentY);
       const splitItem = doc.splitTextToSize(item, pageWidth - 60);
       doc.text(splitItem, 32, currentY);
       currentY += (splitItem.length * 5) + 4;
    });
  } else {
    const splitRequest = doc.splitTextToSize(requestItems as string, pageWidth - 50);
    doc.text(splitRequest, 25, currentY);
  }
  
  yPos += boxHeight + 15;

  // Footer / Sign-off
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  
  const outroText = "Please provide this information in PDF or scanned format at your earliest convenience. If you have any questions regarding this request, please do not hesitate to contact your case manager.";
  const splitOutro = doc.splitTextToSize(outroText, pageWidth - 40);
  doc.text(splitOutro, 20, yPos);
  yPos += (splitOutro.length * 5) + 15;

  doc.text("Sincerely,", 20, yPos);
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("The Underwriting Team", 20, yPos);
  doc.text("Blue Croft Finance", 20, yPos + 5);

  // Save
  let filename = "Request_Letter";
  if (!isMulti) {
     filename += "_" + (requestItems as string).slice(0, 15).replace(/[^a-z0-9]/gi, '_');
  } else {
     filename += "_Full_Information";
  }
  doc.save(`${filename}.pdf`);
};

/**
 * Generates an .ics calendar event file
 */
export const generateCalendarEvent = (title: string, description: string, date?: Date) => {
  const now = new Date();
  const start = date ? new Date(date) : new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow or specific date
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

  const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, "");

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Blue Croft Finance//Underwriting Tool//EN
BEGIN:VEVENT
UID:${Date.now()}@bluecroft.ai
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${title}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Reminder.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
