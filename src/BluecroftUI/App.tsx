import React, { useState, useEffect, useRef } from 'react';
import { LoanData, LoanType, CalculatedMetrics, RiskReport, ExitStrategy, AreaValuation, AuditLogEntry, ChatMessage, UploadedFile, CaseRecord, Applicant } from './types';
import { parseDocument, generateRiskAnalysis, checkAreaValuation, askUnderwriterAI } from './services/geminiService';
import { generatePDFReport, generateRequestLetter, generateCalendarEvent } from './utils/pdfGenerator';
import { LTVChart, RiskGauge } from './components/Charts';
// ... rest of your App.tsx code ...
