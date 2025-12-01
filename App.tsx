

import React, { useState, useEffect, useRef } from 'react';
import { LoanData, LoanType, CalculatedMetrics, RiskReport, ExitStrategy, AreaValuation, AuditLogEntry, ChatMessage, UploadedFile, CaseRecord, Applicant } from './types';
import { parseDocument, generateRiskAnalysis, checkAreaValuation, askUnderwriterAI } from './services/geminiService';
import { generatePDFReport, generateRequestLetter, generateCalendarEvent } from './utils/pdfGenerator';
import { LTVChart, RiskGauge } from './components/Charts';
import { 
  CalculatorIcon, 
  DocumentTextIcon, 
  ArrowPathIcon, 
  ShieldCheckIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  HomeModernIcon,
  BanknotesIcon,
  UserCircleIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CalendarDaysIcon,
  ServerStackIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  ArchiveBoxIcon,
  ArrowLeftIcon,
  TrashIcon,
  UsersIcon,
  UserPlusIcon,
  MinusCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightCircleIcon,
  CursorArrowRaysIcon,
  PlusIcon,
  BellAlertIcon
} from '@heroicons/react/24/outline';

// Initial default state
const DEFAULT_APPLICANT: Applicant = {
  id: '1',
  name: '',
  annualIncome: 0,
  monthlyExpenses: 0,
  totalAssets: 0,
  totalLiabilities: 0
};

const DEFAULT_LOAN_DATA: LoanData = {
  applicants: [{ ...DEFAULT_APPLICANT }],
  loanAmount: 250000,
  propertyValue: 400000,
  purchasePrice: 380000,
  refurbCost: 50000,
  interestRateMonthly: 0.85,
  termMonths: 12,
  loanType: LoanType.BRIDGING,
  propertyAddress: '',
  exitStrategy: ExitStrategy.SALE,
  // Default scheduled date will be set in init
};

const App: React.FC = () => {
  // State for Current Case
  const [loanData, setLoanData] = useState<LoanData>({ 
    ...DEFAULT_LOAN_DATA, 
    id: Date.now().toString(),
    scheduledDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // Default tomorrow
    taskDueDates: {}
  });
  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [areaValuation, setAreaValuation] = useState<AreaValuation | null>(null);
  // Store the creation time of the *current* session so it doesn't change on every render
  const [currentSessionDate, setCurrentSessionDate] = useState<Date>(new Date());
  
  // State for Multi-Case Management
  const [savedCases, setSavedCases] = useState<CaseRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [expandedApplicantId, setExpandedApplicantId] = useState<string | null>(null);
  
  // Rescheduling / Drag-Drop State
  const [reschedulingCaseId, setReschedulingCaseId] = useState<string | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<{ caseId: string, task: string } | null>(null);
  const [draggedTask, setDraggedTask] = useState<{ caseId: string, task: string } | null>(null);

  // Add Task State
  const [addingTaskToCaseId, setAddingTaskToCaseId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");

  // UI States
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingArea, setIsSearchingArea] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'report' | 'calendar'>('input');
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0); 
  const [activeApplicantIndex, setActiveApplicantIndex] = useState(0);

  // New Features States
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isSyncingCRM, setIsSyncingCRM] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Calculations ---
  useEffect(() => {
    const { loanAmount, propertyValue, purchasePrice, refurbCost, interestRateMonthly, termMonths } = loanData;
    
    // Avoid division by zero
    const totalCost = purchasePrice + refurbCost;
    
    const calculated: CalculatedMetrics = {
      ltv: propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0,
      ltc: totalCost > 0 ? (loanAmount / totalCost) * 100 : 0,
      monthlyInterest: loanAmount * (interestRateMonthly / 100),
      totalInterest: loanAmount * (interestRateMonthly / 100) * termMonths,
      grossLoan: loanAmount + (loanAmount * (interestRateMonthly / 100) * termMonths),
    };
    
    setMetrics(calculated);
  }, [loanData]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  // --- Helpers ---
  const addAuditLog = (action: string, details: string) => {
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      action,
      user: 'Case Manager',
      details
    };
    setAuditLog(prev => [entry, ...prev]);
  };

  const getMainApplicantName = (data: LoanData) => {
    if (!data.applicants || data.applicants.length === 0) return 'Unnamed Applicant';
    return data.applicants[0].name || 'Unnamed Applicant';
  };

  const getAllApplicantNames = (data: LoanData) => {
    if (!data.applicants || data.applicants.length === 0) return 'New Applicant';
    const names = data.applicants.map(a => a.name).filter(n => n && n.trim().length > 0);
    return names.length > 0 ? names.join(' & ') : 'Unnamed Applicant';
  }

  // Helper to determine the effective date for a specific task
  const getTaskDueDate = (c: CaseRecord | { loanData: LoanData, createdAt: Date }, task: string): Date => {
    if (c.loanData.taskDueDates && c.loanData.taskDueDates[task]) {
      return new Date(c.loanData.taskDueDates[task]);
    }
    // Fallback to case scheduled date
    // Type guard to check if 'scheduledDate' exists on 'c' (CaseRecord has it, but the anonymous object from current case might rely on loanData)
    // Actually, both types passed here should have scheduledDate in loanData if properly typed, or scheduledDate on the record.
    if ('scheduledDate' in c && c.scheduledDate) {
      return new Date(c.scheduledDate);
    }
    if (c.loanData.scheduledDate) {
      return new Date(c.loanData.scheduledDate);
    }
    // Fallback to creation + 1 day
    const d = new Date(c.createdAt);
    d.setDate(d.getDate() + 1);
    return d;
  };

  // --- Handlers ---
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setLoanData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleApplicantChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const newApplicants = [...loanData.applicants];
    if (!newApplicants[index]) return; // Guard
    
    newApplicants[index] = {
      ...newApplicants[index],
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    };
    setLoanData(prev => ({ ...prev, applicants: newApplicants }));
  };

  const addApplicant = () => {
    setLoanData(prev => ({
      ...prev,
      applicants: [...prev.applicants, { ...DEFAULT_APPLICANT, id: Date.now().toString() }]
    }));
    setActiveApplicantIndex(loanData.applicants.length);
  };

  const removeApplicant = (index: number) => {
    if (loanData.applicants.length <= 1) {
       // Just clear the first one if it's the only one
       const newApplicants = [{ ...DEFAULT_APPLICANT, id: Date.now().toString() }];
       setLoanData(prev => ({ ...prev, applicants: newApplicants }));
       return;
    }
    const newApplicants = loanData.applicants.filter((_, i) => i !== index);
    setLoanData(prev => ({ ...prev, applicants: newApplicants }));
    if (activeApplicantIndex >= newApplicants.length) {
      setActiveApplicantIndex(newApplicants.length - 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    addAuditLog('Upload Started', `Processing ${files.length} document(s)...`);

    try {
      const promises = Array.from(files).map((file: File) => {
        return new Promise<UploadedFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const result = reader.result;
             if (typeof result === 'string') {
               resolve({
                 name: file.name,
                 type: file.type,
                 data: result.split(',')[1]
               });
             } else {
               reject(new Error("Failed to read file"));
             }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const processedFiles = await Promise.all(promises);
      setUploadedFiles(prev => [...prev, ...processedFiles]);

      const extractedData = await parseDocument(processedFiles);
      
      // Merge applicants carefully
      setLoanData(prev => {
         const mergedApplicants = extractedData.applicants && extractedData.applicants.length > 0 
            ? extractedData.applicants.map((a, i) => ({ ...DEFAULT_APPLICANT, id: `${Date.now()}-${i}`, ...a }))
            : prev.applicants;
         
         return { ...prev, ...extractedData, applicants: mergedApplicants };
      });

      // Safely reset applicant index to first applicant to avoid white screen
      setActiveApplicantIndex(0);
      
      addAuditLog('Parsing Complete', `Extracted data from ${files.length} documents.`);
      setActiveTab('input'); 

    } catch (err) {
      setParseError("Couldn't read files. Please check format.");
      addAuditLog('Error', 'Failed to parse documents.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAreaSearch = async () => {
    if (!loanData.propertyAddress) return;
    setIsSearchingArea(true);
    addAuditLog('Market Search', `Analyzing area: ${loanData.propertyAddress}`);
    try {
      const result = await checkAreaValuation(loanData.propertyAddress);
      setAreaValuation(result);
      addAuditLog('Market Search', 'Retrieved valuation insights.');
    } catch (error) {
      console.error("Area search failed", error);
    } finally {
      setIsSearchingArea(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!metrics) return;
    setIsAnalyzing(true);
    setActiveTab('report');
    addAuditLog('Underwriting', 'Generating AI Risk Assessment...');
    try {
      const report = await generateRiskAnalysis(loanData, metrics);
      setRiskReport(report);
      addAuditLog('Underwriting', `Risk Score: ${report.score}/100 generated.`);
    } catch (error) {
      console.error("Analysis failed", error);
      addAuditLog('Error', 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!metrics || !riskReport) return;
    setIsGeneratingPdf(true);
    addAuditLog('Export', 'Downloading PDF Memo...');
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await generatePDFReport(loanData, metrics, riskReport);
    } catch (error) {
      console.error("PDF generation failed", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateLetter = (applicantName: string, items: string | string[], address?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Helper to generate a temp loan data object for the letter generator
    // For letter generation, we just use the name passed in, usually the main one
    const tempLoanData: LoanData = { ...loanData, applicants: [{...DEFAULT_APPLICANT, name: applicantName}], propertyAddress: address || loanData.propertyAddress };
    
    generateRequestLetter(tempLoanData, items);
    const logMsg = Array.isArray(items) ? `Generated full request letter for ${applicantName}.` : `Generated item request letter for ${applicantName}.`;
    addAuditLog('Correspondence', logMsg);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatThinking(true);

    const answer = await askUnderwriterAI(
      userMsg.text, 
      loanData, 
      metrics, 
      riskReport, 
      uploadedFiles.map(f => f.name)
    );

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: answer,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, aiMsg]);
    setIsChatThinking(false);
    addAuditLog('Q&A', 'Queried AI Underwriting Assistant');
  };

  const handleTaskToggle = (step: string) => {
    const newSet = new Set(completedTasks);
    if (newSet.has(step)) {
      newSet.delete(step);
      addAuditLog('Task Update', `Unmarked task: ${step}`);
    } else {
      newSet.add(step);
      addAuditLog('Task Update', `Completed task: ${step}`);
    }
    setCompletedTasks(newSet);
  };

  const handleSavedCaseTaskToggle = (caseId: string, step: string) => {
    setSavedCases(prevCases => prevCases.map(c => {
      if (c.id === caseId) {
        const newSet = new Set(c.completedTasks);
        if (newSet.has(step)) {
          newSet.delete(step);
          addAuditLog('Task Update', `Case ${getMainApplicantName(c.loanData)}: Unmarked ${step}`);
        } else {
          newSet.add(step);
          addAuditLog('Task Update', `Case ${getMainApplicantName(c.loanData)}: Completed ${step}`);
        }
        return { ...c, completedTasks: newSet };
      }
      return c;
    }));
  };

  const handleSyncCRM = () => {
    setIsSyncingCRM(true);
    // Simulate API call
    setTimeout(() => {
      setIsSyncingCRM(false);
      addAuditLog('CRM Sync', 'Loan data pushed to internal CRM successfully.');
      alert("Successfully synced with CRM! Borrower records updated.");
    }, 1500);
  };

  const handleCalendarInvite = (applicant: string, score: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    generateCalendarEvent(`Follow up: ${applicant}`, `Review loan application. Risk Score: ${score}`);
    addAuditLog('Calendar', 'Created follow-up event.');
  };

  const handleTaskReminder = (task: string, dueDate: Date, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    generateCalendarEvent(`Task: ${task}`, `Reminder for Blue Croft Finance application.`, dueDate);
    addAuditLog('Calendar', `Created reminder for task: ${task}`);
  };

  const handleDeleteCase = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
      if (id === 'current') {
         // Reset current state
         setLoanData({ 
           ...DEFAULT_LOAN_DATA, 
           id: Date.now().toString(), 
           applicants: [{ ...DEFAULT_APPLICANT }],
           scheduledDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
           taskDueDates: {}
         });
         setMetrics(null);
         setRiskReport(null);
         setAreaValuation(null);
         setUploadedFiles([]);
         setChatMessages([]);
         setCompletedTasks(new Set());
         setParseError(null);
         setFileInputKey(prev => prev + 1);
         setCurrentSessionDate(new Date()); // Reset session date
         if (selectedCaseId === 'current') setSelectedCaseId(null);
         addAuditLog('System', 'Deleted/Reset current active case.');
      } else {
         // Remove from saved
         setSavedCases(prev => prev.filter(c => c.id !== id));
         if (selectedCaseId === id) setSelectedCaseId(null);
         addAuditLog('System', 'Deleted case record.');
      }
    }
  };

  // --- Reschedule & Add Task Handlers ---
  
  const handleRescheduleStart = (caseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReschedulingCaseId(caseId);
    setReschedulingTask(null);
    setSelectedDate(null); // Close day view to show calendar grid
    addAuditLog('Calendar', 'Rescheduling mode active. Select a new date for case.');
  };

  const handleRescheduleTaskStart = (caseId: string, task: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReschedulingTask({ caseId, task });
    setReschedulingCaseId(null);
    setSelectedDate(null);
    addAuditLog('Calendar', 'Rescheduling task. Select a new date.');
  }

  const handleCancelReschedule = () => {
    setReschedulingCaseId(null);
    setReschedulingTask(null);
    addAuditLog('Calendar', 'Rescheduling cancelled.');
  };

  const moveCaseToDate = (caseId: string, newDate: Date) => {
    if (caseId === 'current') {
      setLoanData(prev => ({ ...prev, scheduledDate: newDate, taskDueDates: {} }));
      addAuditLog('Calendar', `Moved current case to ${newDate.toLocaleDateString()}`);
    } else {
      setSavedCases(prev => prev.map(c => {
        if (c.id === caseId) {
          return { ...c, scheduledDate: newDate, loanData: { ...c.loanData, scheduledDate: newDate } };
        }
        return c;
      }));
      addAuditLog('Calendar', `Moved saved case to ${newDate.toLocaleDateString()}`);
    }
  };

  const moveTaskToDate = (caseId: string, task: string, newDate: Date) => {
    const isoDate = newDate.toISOString();
    if (caseId === 'current') {
      setLoanData(prev => ({
        ...prev,
        taskDueDates: { ...prev.taskDueDates, [task]: isoDate }
      }));
      addAuditLog('Calendar', `Moved task "${task}" to ${newDate.toLocaleDateString()}`);
    } else {
      setSavedCases(prev => prev.map(c => {
        if (c.id === caseId) {
          return {
            ...c,
            loanData: {
              ...c.loanData,
              taskDueDates: { ...c.loanData.taskDueDates, [task]: isoDate }
            }
          };
        }
        return c;
      }));
      addAuditLog('Calendar', `Moved task "${task}" to ${newDate.toLocaleDateString()}`);
    }
  };

  const handleAddTask = (caseId: string) => {
    if (!newTaskText.trim() || !selectedDate) return;
    
    // Add to Risk Report nextSteps and set due date
    const isoDate = selectedDate.toISOString();
    
    if (caseId === 'current') {
       const updatedSteps = [...(riskReport?.nextSteps || []), newTaskText];
       setRiskReport(prev => prev ? ({ ...prev, nextSteps: updatedSteps }) : null);
       setLoanData(prev => ({
         ...prev,
         taskDueDates: { ...prev.taskDueDates, [newTaskText]: isoDate }
       }));
    } else {
       setSavedCases(prev => prev.map(c => {
         if (c.id === caseId) {
           const updatedSteps = [...(c.riskReport.nextSteps || []), newTaskText];
           return {
             ...c,
             riskReport: { ...c.riskReport, nextSteps: updatedSteps },
             loanData: { 
               ...c.loanData, 
               taskDueDates: { ...c.loanData.taskDueDates, [newTaskText]: isoDate } 
             }
           }
         }
         return c;
       }));
    }
    
    addAuditLog('Calendar', `Added manual task: ${newTaskText}`);
    setNewTaskText("");
    setAddingTaskToCaseId(null);
  }

  const handleRescheduleConfirm = (newDate: Date) => {
    if (reschedulingTask) {
      moveTaskToDate(reschedulingTask.caseId, reschedulingTask.task, newDate);
      setReschedulingTask(null);
    } else if (reschedulingCaseId) {
      moveCaseToDate(reschedulingCaseId, newDate);
      setReschedulingCaseId(null);
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, caseId: string, task?: string) => {
    e.dataTransfer.effectAllowed = "move";
    if (task) {
      // Dragging a specific task
      setDraggedTask({ caseId, task });
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("caseId", caseId);
      e.dataTransfer.setData("task", task);
    } else {
      // Dragging a whole case
      e.dataTransfer.setData("type", "case");
      e.dataTransfer.setData("caseId", caseId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    const caseId = e.dataTransfer.getData("caseId");
    
    if (type === "task") {
      const task = e.dataTransfer.getData("task");
      if (caseId && task) {
        moveTaskToDate(caseId, task, date);
      }
      setDraggedTask(null);
    } else if (type === "case") {
      if (caseId) {
        moveCaseToDate(caseId, date);
      }
    }
  };

  const loadSampleData = () => {
    setLoanData({
      ...DEFAULT_LOAN_DATA,
      id: Date.now().toString(),
      applicants: [
        {
          id: '1',
          name: "Oakwood Developments Ltd",
          annualIncome: 120000,
          monthlyExpenses: 3500,
          totalAssets: 1500000,
          totalLiabilities: 450000
        },
        {
          id: '2',
          name: "John Smith (Director)",
          annualIncome: 85000,
          monthlyExpenses: 2000,
          totalAssets: 450000,
          totalLiabilities: 150000
        }
      ],
      loanAmount: 450000,
      propertyValue: 750000,
      purchasePrice: 600000,
      refurbCost: 100000,
      interestRateMonthly: 0.95,
      termMonths: 9,
      loanType: LoanType.REFURBISHMENT,
      propertyAddress: "12 High Street, Manchester, M1 1AA",
      exitStrategy: ExitStrategy.SALE,
      scheduledDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      taskDueDates: {}
    });
    addAuditLog('System', 'Loaded sample dataset with Joint Applicants.');
  };

  const handleSaveAndNew = () => {
    // If we have active data, save it
    const mainName = getAllApplicantNames(loanData);
    if (riskReport && metrics && mainName) {
      const newCase: CaseRecord = {
        id: loanData.id || Date.now().toString(),
        loanData: { ...loanData },
        metrics: { ...metrics },
        riskReport: { ...riskReport },
        completedTasks: new Set(completedTasks),
        createdAt: currentSessionDate,
        scheduledDate: loanData.scheduledDate || new Date()
      };
      
      setSavedCases(prev => [newCase, ...prev]);
      addAuditLog('System', `Saved Case: ${mainName}`);
    } else {
      if (mainName && !window.confirm("Current form is incomplete. Discard and start new?")) {
        return;
      }
    }

    // Reset All State
    setLoanData({ 
      ...DEFAULT_LOAN_DATA, 
      id: Date.now().toString(), 
      applicants: [{ ...DEFAULT_APPLICANT }],
      scheduledDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
      taskDueDates: {}
    });
    setMetrics(null);
    setRiskReport(null);
    setAreaValuation(null);
    setUploadedFiles([]);
    setChatMessages([]);
    setCompletedTasks(new Set());
    setParseError(null);
    setFileInputKey(prev => prev + 1);
    setActiveTab('input');
    setSelectedCaseId(null);
    setSelectedDate(null);
    setActiveApplicantIndex(0);
    setCurrentSessionDate(new Date()); // New session, new date
    
    addAuditLog('System', 'Started new case.');
  };

  // --- Render Helpers ---

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);

  const getStatusColor = (completed: number, total: number) => {
    if (total === 0) return 'text-slate-400 bg-slate-100';
    if (completed === 0) return 'text-red-600 bg-red-100 border-red-200';
    if (completed === total) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
    return 'text-orange-600 bg-orange-100 border-orange-200';
  };

  const getAllCases = () => {
    return [
      ...(riskReport && metrics ? [{
        id: 'current', 
        loanData, 
        riskReport, 
        completedTasks,
        createdAt: currentSessionDate, // Use stable session date
        scheduledDate: loanData.scheduledDate
      }] : []),
      ...savedCases
    ];
  };

  // Logic to determine if a case has a task due on a given day
  // Checks granular tasks FIRST, then case base date
  const getCasesDueOnDate = (date: Date) => {
     return getAllCases().filter(c => {
        // 1. Check if any specific task is due today
        if (c.loanData.taskDueDates) {
           const hasTaskToday = Object.values(c.loanData.taskDueDates).some(dStr => {
              const d = new Date(dStr);
              return d.getDate() === date.getDate() && 
                     d.getMonth() === date.getMonth() &&
                     d.getFullYear() === date.getFullYear();
           });
           if (hasTaskToday) return true;
        }

        // 2. Check base scheduled date (default for tasks without specific dates)
        let baseDueDate: Date;
        if (c.scheduledDate) {
          baseDueDate = new Date(c.scheduledDate);
        } else {
          baseDueDate = new Date(c.createdAt);
          baseDueDate.setDate(baseDueDate.getDate() + 1);
        }
        
        // If scheduled date matches AND there are tasks that don't have overrides
        const matchesBase = baseDueDate.getDate() === date.getDate() && 
                            baseDueDate.getMonth() === date.getMonth() && 
                            baseDueDate.getFullYear() === date.getFullYear();
        
        if (matchesBase) {
           // We include it if there are tasks. If strictly all tasks have moved away, maybe we shouldn't?
           // For simplicity, we show the case if the base date matches.
           return true; 
        }
        return false;
     });
  };

  const renderActiveApplicantForm = () => {
    const app = loanData.applicants[activeApplicantIndex];
    if (!app) return <div className="p-4 text-center text-slate-400">No applicant selected</div>;

    return (
      <div className="grid grid-cols-1 gap-4 animate-fadeIn">
         <div className="group">
            <label className="text-xs font-extrabold text-slate-400 ml-1 uppercase tracking-wide">Applicant Name</label>
            <div className="flex gap-2">
               <div className="relative mt-1 flex-1">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <UserCircleIcon className="h-5 w-5" />
                 </div>
                 <input 
                   type="text" 
                   name="name" 
                   value={app.name} 
                   onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} 
                   className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 pl-12 pr-4 text-slate-700 font-bold focus:border-violet-400 focus:bg-white focus:outline-none transition-all shadow-inner" 
                   placeholder="e.g. John Doe or Company Ltd" 
                 />
               </div>
               {loanData.applicants.length > 1 && (
                 <button 
                   onClick={() => removeApplicant(activeApplicantIndex)}
                   className="mt-1 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 p-3 rounded-2xl transition-colors"
                   title="Remove Applicant"
                 >
                   <MinusCircleIcon className="h-6 w-6" />
                 </button>
               )}
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
             <InputGroup 
               label="Annual Income" 
               name="annualIncome" 
               value={app.annualIncome} 
               onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} 
               prefix="£" 
               type="number"
             />
             <InputGroup 
               label="Monthly Expenses" 
               name="monthlyExpenses" 
               value={app.monthlyExpenses} 
               onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} 
               prefix="£" 
               type="number"
             />
         </div>
         
         <div className="grid grid-cols-2 gap-4">
             <InputGroup 
               label="Total Assets" 
               name="totalAssets" 
               value={app.totalAssets} 
               onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} 
               prefix="£" 
               type="number"
             />
             <InputGroup 
               label="Total Liabilities" 
               name="totalLiabilities" 
               value={app.totalLiabilities} 
               onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} 
               prefix="£" 
               type="number"
             />
         </div>
      </div>
    );
  };

  const renderCalendarDays = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    
    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100/50 rounded-xl opacity-50"></div>);
    }
    
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(today.getFullYear(), today.getMonth(), i);
      const isToday = i === today.getDate();
      
      const casesDue = getCasesDueOnDate(currentDate);
      
      let totalTasks = 0;
      let totalPending = 0;

      casesDue.forEach(c => {
         // Only count tasks actually due on this date
         if (c.riskReport?.nextSteps && Array.isArray(c.riskReport.nextSteps)) {
             const relevantTasks = c.riskReport.nextSteps.filter(task => {
                const due = getTaskDueDate(c, task);
                return due.getDate() === currentDate.getDate() && due.getMonth() === currentDate.getMonth();
             });
             
             const pending = relevantTasks.filter(s => !c.completedTasks.has(s)).length;
             totalTasks += relevantTasks.length;
             totalPending += pending;
         }
      });
      
      const isRescheduleTarget = reschedulingCaseId !== null || reschedulingTask !== null;

      days.push(
        <div 
          key={i}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, currentDate)}
          onClick={() => {
            if (isRescheduleTarget) {
              handleRescheduleConfirm(currentDate);
            } else {
              setSelectedDate(currentDate);
            }
          }}
          className={`h-24 p-2 border rounded-xl flex flex-col justify-between transition-all cursor-pointer group relative
            ${isRescheduleTarget 
                ? 'bg-violet-50/50 border-violet-300 border-dashed hover:bg-violet-100 animate-pulse' 
                : (isToday ? 'bg-white border-violet-400 shadow-md ring-2 ring-violet-200' : 'bg-white border-slate-100 hover:border-violet-200 hover:shadow-md')}
            ${selectedDate?.getDate() === i && !isRescheduleTarget ? 'ring-2 ring-violet-500 bg-violet-50' : ''}`}
        >
          <div className="flex justify-between items-start pointer-events-none">
             <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>{i}</span>
             {totalPending > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </div>
          
          <div className="space-y-1 pointer-events-none">
             {totalPending > 0 ? (
                <div className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded truncate font-medium border border-red-100 group-hover:bg-red-100 transition-colors">
                  {totalPending} Tasks
                </div>
             ) : (totalTasks > 0 ? (
                <div className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded truncate font-medium border border-emerald-100">
                   All Done
                </div>
             ) : null)}
          </div>
          
          {/* Hover Hint or Reschedule Text */}
          {isRescheduleTarget ? (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-violet-600 bg-white/80 px-2 py-1 rounded">Move Here</span>
             </div>
          ) : (
             <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/5 rounded-xl transition-colors pointer-events-none"></div>
          )}
        </div>
      );
    }
    return days;
  };

  const renderDayDetails = () => {
    if (!selectedDate) return null;
    const cases = getCasesDueOnDate(selectedDate);
    
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-200 h-full animate-fadeIn shadow-lg flex flex-col">
         <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 shrink-0">
           <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
           </button>
           <div>
              <h3 className="text-xl font-bold text-slate-800">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="text-sm text-slate-500">{cases.length} Case(s) Active</p>
           </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {cases.length === 0 ? (
               <div className="text-center py-10 text-slate-400 italic">No tasks scheduled for this day.</div>
            ) : (
               cases.map(c => {
                 const isCurrent = c.id === 'current';
                 const displayName = getAllApplicantNames(c.loanData);
                 const isExpanded = expandedApplicantId === c.id;
                 const nextSteps = c.riskReport?.nextSteps || [];
                 
                 // Filter to only tasks due ON THIS DATE
                 const tasksForDate = nextSteps.filter(task => {
                    const due = getTaskDueDate(c, task);
                    return due.getDate() === selectedDate.getDate() && due.getMonth() === selectedDate.getMonth();
                 });

                 const totalCount = tasksForDate.length;
                 const completedCount = tasksForDate.filter(t => c.completedTasks.has(t)).length;

                 return (
                   <div key={c.id} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300">
                      
                      {/* Accordion Header */}
                      <div 
                        onClick={() => setExpandedApplicantId(isExpanded ? null : c.id)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                         <div className="flex items-center gap-3 overflow-hidden flex-1">
                            <div className={`shrink-0 w-2 h-10 rounded-full ${completedCount === totalCount && totalCount > 0 ? 'bg-emerald-500' : (completedCount > 0 ? 'bg-orange-500' : 'bg-red-500')}`}></div>
                            <div className="overflow-hidden flex-1">
                               <h4 className="font-bold text-slate-700 truncate" title={displayName}>{displayName}</h4>
                               <p className="text-xs text-slate-400 truncate">{c.loanData.propertyAddress || 'No Address'}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3 shrink-0">
                            {/* Move Whole Case Button */}
                            <button 
                               onClick={(e) => handleRescheduleStart(c.id, e)}
                               className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-violet-600 hover:border-violet-300 transition-colors group/move z-10"
                               title="Move entire case to another date"
                            >
                               <ArrowRightCircleIcon className="h-5 w-5 group-hover/move:translate-x-0.5 transition-transform" />
                            </button>
                            <div className="text-right hidden sm:block w-16">
                               <span className="text-xs font-bold text-slate-500 block">{completedCount}/{totalCount}</span>
                               <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${completedCount === totalCount ? 'bg-emerald-500' : 'bg-violet-500'}`} 
                                    style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                  ></div>
                               </div>
                            </div>
                            {isExpanded ? <ChevronUpIcon className="h-5 w-5 text-slate-400" /> : <ChevronDownIcon className="h-5 w-5 text-slate-400" />}
                         </div>
                      </div>

                      {/* Expanded Content */}
                      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="p-4 pt-0 border-t border-slate-200/50 bg-white/50 space-y-2 overflow-y-auto max-h-[400px] custom-scrollbar">
                           <div className="h-2"></div>
                           
                           {/* Task List */}
                           {tasksForDate.length === 0 && <div className="text-xs text-slate-400 italic text-center py-2">No specific tasks due today.</div>}
                           {tasksForDate.map((step: string, idx: number) => (
                             <div 
                                key={idx} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, c.id, step)}
                                onClick={(e) => { e.stopPropagation(); isCurrent ? handleTaskToggle(step) : handleSavedCaseTaskToggle(c.id, step); }}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-md
                                  ${c.completedTasks.has(step) ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-violet-300 shadow-sm'}`}
                             >
                                <div className="flex items-center gap-3">
                                  <div className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${c.completedTasks.has(step) ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                     {c.completedTasks.has(step) && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className={`text-sm ${c.completedTasks.has(step) ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={(e) => handleTaskReminder(step, selectedDate!, e)}
                                     className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors"
                                     title="Add to Calendar"
                                   >
                                      <BellAlertIcon className="h-4 w-4" />
                                   </button>
                                   {/* Move Single Task */}
                                   <button 
                                     onClick={(e) => handleRescheduleTaskStart(c.id, step, e)}
                                     className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors"
                                     title="Move this task"
                                   >
                                      <CalendarDaysIcon className="h-4 w-4" />
                                   </button>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleGenerateLetter(displayName, step, c.loanData.propertyAddress, e); }}
                                      className="text-violet-500 hover:text-violet-700 p-1.5 hover:bg-violet-50 rounded-lg transition-colors"
                                      title="Generate Letter"
                                   >
                                      <EnvelopeIcon className="h-4 w-4" />
                                   </button>
                                </div>
                             </div>
                           ))}
                           
                           {/* Add Task Input */}
                           {addingTaskToCaseId === c.id ? (
                              <div className="mt-2 flex gap-2">
                                 <input 
                                    autoFocus
                                    className="flex-1 bg-white border border-violet-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                                    placeholder="Type task..."
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(c.id)}
                                 />
                                 <button onClick={() => handleAddTask(c.id)} className="bg-violet-600 text-white px-3 rounded-lg text-xs font-bold">Add</button>
                                 <button onClick={() => setAddingTaskToCaseId(null)} className="text-slate-400 hover:text-slate-600 px-2"><XMarkIcon className="h-4 w-4"/></button>
                              </div>
                           ) : (
                              <button 
                                onClick={() => setAddingTaskToCaseId(c.id)}
                                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-violet-600 py-2 border border-dashed border-slate-200 hover:border-violet-300 rounded-lg transition-colors"
                              >
                                <PlusIcon className="h-3 w-3" /> Add Task
                              </button>
                           )}

                           <div className="flex gap-2 mt-4 pt-2 border-t border-slate-100">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleGenerateLetter(displayName, tasksForDate, c.loanData.propertyAddress); }}
                                className="flex-1 text-xs bg-violet-50 text-violet-700 py-2 rounded-lg hover:bg-violet-100 font-bold"
                              >
                                Request All
                              </button>
                           </div>
                        </div>
                      </div>

                   </div>
                 );
               })
            )}
         </div>
      </div>
    );
  };

  const renderSelectedCaseDetails = () => {
    let activeCase: CaseRecord | null = null;
    let isCurrent = false;

    if (selectedCaseId === 'current') {
      if (riskReport && metrics) {
        activeCase = {
           id: 'current',
           loanData,
           metrics,
           riskReport,
           completedTasks,
           createdAt: currentSessionDate,
           scheduledDate: loanData.scheduledDate
        };
        isCurrent = true;
      }
    } else {
      activeCase = savedCases.find(c => c.id === selectedCaseId) || null;
    }

    if (!activeCase) return null;

    // Safety checks for undefined/null arrays
    const nextSteps = activeCase.riskReport.nextSteps || [];
    const completedCount = activeCase.completedTasks.size;
    const totalCount = nextSteps.length;
    const displayName = getAllApplicantNames(activeCase.loanData);

    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-200 h-full animate-fadeIn shadow-lg">
         <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button onClick={() => setSelectedCaseId(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
           </button>
            <div className="flex-1 overflow-hidden">
              <h3 className="text-xl font-bold text-slate-800 truncate" title={displayName}>{displayName}</h3>
              <p className="text-sm text-slate-500 truncate">{activeCase.loanData.propertyAddress}</p>
            </div>
            <div className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(completedCount, totalCount)}`}>
               {completedCount}/{totalCount} Tasks
            </div>
         </div>

         <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">All Action Plan Items</h4>
            {nextSteps.map((step, idx) => {
               // Show due date if specific
               const due = getTaskDueDate(activeCase!, step);
               const isToday = new Date().toDateString() === due.toDateString();
               
               return (
              <div 
                 key={idx} 
                 onClick={() => isCurrent ? handleTaskToggle(step) : handleSavedCaseTaskToggle(activeCase!.id, step)}
                 className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group
                   ${activeCase!.completedTasks.has(step) ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-violet-300 hover:shadow-sm'}`}
              >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${activeCase!.completedTasks.has(step) ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                       {activeCase!.completedTasks.has(step) && <CheckCircleIcon className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex flex-col">
                       <span className={`text-sm ${activeCase!.completedTasks.has(step) ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step}</span>
                       <span className="text-[10px] text-slate-400 font-mono">Due: {due.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                     <button 
                       onClick={(e) => handleTaskReminder(step, due, e)}
                       className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                       title="Add to Calendar"
                     >
                        <BellAlertIcon className="h-4 w-4" />
                     </button>
                     <button 
                       onClick={(e) => handleRescheduleTaskStart(activeCase!.id, step, e)}
                       className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                       title="Move this task"
                     >
                        <CalendarDaysIcon className="h-4 w-4" />
                     </button>
                     <button 
                        onClick={(e) => handleGenerateLetter(displayName, step, activeCase!.loanData.propertyAddress, e)}
                        className="text-violet-500 hover:text-violet-700 p-1.5 hover:bg-violet-50 rounded-lg transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                        title="Generate Request Letter"
                     >
                        <EnvelopeIcon className="h-4 w-4" />
                     </button>
                  </div>
              </div>
            )})}
         </div>
         {/* ... Footer buttons ... */}
         <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => handleGenerateLetter(displayName, nextSteps, activeCase!.loanData.propertyAddress)}
              className="flex-1 bg-violet-100 text-violet-700 py-2 rounded-xl text-sm font-bold hover:bg-violet-200 transition-colors flex items-center justify-center gap-2"
            >
              <DocumentDuplicateIcon className="h-4 w-4" /> Request All Info
            </button>
            <button 
              onClick={(e) => handleCalendarInvite(displayName, activeCase!.riskReport.score, e)}
              className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
               <CalendarDaysIcon className="h-4 w-4" /> Add to Outlook
            </button>
            <button 
              onClick={(e) => handleDeleteCase(activeCase!.id, e)}
              className="bg-red-50 text-red-600 py-2 px-4 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center"
              title="Delete Case"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
         </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-500 text-slate-800 pb-12 overflow-x-hidden relative">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-[100] backdrop-blur-md bg-white/90 border-b border-white/20 shadow-lg shadow-blue-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white p-2.5 rounded-2xl shadow-lg shadow-violet-200 transform transition hover:rotate-6 hover:scale-105 duration-300">
               <CalculatorIcon className="h-6 w-6" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-800 hidden sm:inline">BlueCroft<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-500">.ai</span></span>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Segmented Control */}
             <div className="hidden md:flex bg-slate-100/80 p-1.5 rounded-full gap-1 border border-white/50 shadow-inner">
               <button 
                 onClick={() => setActiveTab('input')}
                 className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 ${activeTab === 'input' ? 'bg-white text-violet-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Input
               </button>
               <button 
                 onClick={() => setActiveTab('report')}
                 className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 ${activeTab === 'report' ? 'bg-white text-violet-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Report
               </button>
               <button 
                 onClick={() => setActiveTab('calendar')}
                 className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'calendar' ? 'bg-white text-violet-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <CalendarDaysIcon className="h-4 w-4" /> Calendar
               </button>
            </div>
            
            <button
               onClick={() => setChatOpen(!chatOpen)}
               className="md:hidden bg-violet-100 text-violet-600 p-2 rounded-xl"
            >
               <ChatBubbleLeftRightIcon className="h-6 w-6" />
            </button>

            <button 
              onClick={handleSaveAndNew}
              className="group flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-600 bg-white/50 hover:bg-white px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent hover:border-violet-100"
            >
              <FolderPlusIcon className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
              <span className="hidden sm:inline">Save & New</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 px-4 sm:px-6 flex flex-col lg:flex-row max-w-[90rem] mx-auto gap-6 relative min-h-[calc(100vh-8rem)]">
        
        {/* Left Side: Audit Trail (Desktop) - Only show on Input/Report tabs */}
        {activeTab !== 'calendar' && (
          <aside className="hidden xl:flex flex-col w-64 shrink-0 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/20 p-4 h-[calc(100vh-8rem)] sticky top-28 overflow-hidden z-10">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5" /> Case Timeline
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {auditLog.length === 0 && <p className="text-white/40 text-sm italic">No actions recorded yet.</p>}
              {auditLog.map(entry => (
                <div key={entry.id} className="bg-white/80 p-3 rounded-xl shadow-sm text-xs animate-fadeIn">
                  <div className="flex justify-between text-slate-400 mb-1 font-mono">
                    <span>{entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="font-bold text-violet-600">{entry.user}</span>
                  </div>
                  <div className="font-bold text-slate-700">{entry.action}</div>
                  <div className="text-slate-500 mt-1 leading-tight">{entry.details}</div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center: Main App */}
        <div className="flex-1 max-w-7xl mx-auto w-full z-20">
          
          {/* Calendar View */}
          {activeTab === 'calendar' && (
             <div className="animate-fadeIn w-full h-full">
               <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/60 min-h-[800px]">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                     <div>
                       <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
                         <CalendarDaysIcon className="h-8 w-8 text-fuchsia-500" /> Employee Dashboard
                       </h2>
                       <p className="text-slate-500 mt-1 font-medium">Manage underwriting tasks across all applicants.</p>
                     </div>
                     <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl">
                        {/* Reschedule Message */}
                        {reschedulingCaseId ? (
                           <div className="flex items-center gap-3 bg-violet-100 px-4 py-2 rounded-xl">
                              <span className="animate-pulse flex items-center gap-2 text-violet-600 font-bold text-sm">
                                <CursorArrowRaysIcon className="h-5 w-5" />
                                Select a new date for case...
                              </span>
                              <button onClick={handleCancelReschedule} className="bg-white text-violet-600 hover:text-red-500 p-1 rounded-full shadow-sm"><XMarkIcon className="h-4 w-4" /></button>
                           </div>
                        ) : reschedulingTask ? (
                           <div className="flex items-center gap-3 bg-violet-100 px-4 py-2 rounded-xl">
                              <span className="animate-pulse flex items-center gap-2 text-violet-600 font-bold text-sm">
                                <CalendarDaysIcon className="h-5 w-5" />
                                Select date for: {reschedulingTask.task.substring(0, 20)}...
                              </span>
                              <button onClick={handleCancelReschedule} className="bg-white text-violet-600 hover:text-red-500 p-1 rounded-full shadow-sm"><XMarkIcon className="h-4 w-4" /></button>
                           </div>
                        ) : (
                           <span className="font-bold text-slate-700 px-4">
                             {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                           </span>
                        )}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                     
                     {/* Applicants Sidebar */}
                     <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 min-h-[500px]">
                           <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                             <ArchiveBoxIcon className="h-5 w-5 text-violet-500" /> 
                             Active Cases
                           </h3>
                           
                           <div className="space-y-2">
                              {/* Current Active Case */}
                              {riskReport && metrics && (
                                <div 
                                  className="relative group cursor-grab active:cursor-grabbing"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, 'current')}
                                >
                                  <button 
                                    onClick={() => { setSelectedCaseId('current'); setSelectedDate(null); }}
                                    className={`w-full text-left p-3 rounded-xl border transition-all pr-8 ${selectedCaseId === 'current' ? 'bg-white border-violet-400 shadow-md ring-1 ring-violet-200' : 'bg-white border-slate-200 hover:border-violet-300'}`}
                                  >
                                     <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700 truncate">{getAllApplicantNames(loanData)}</span>
                                        <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 rounded uppercase font-bold shrink-0">New</span>
                                     </div>
                                     <div className="flex items-center gap-2 text-xs">
                                       <span className={`w-2 h-2 rounded-full shrink-0 ${completedTasks.size === (riskReport.nextSteps?.length || 0) ? 'bg-emerald-500' : (completedTasks.size > 0 ? 'bg-orange-500' : 'bg-red-500')}`}></span>
                                       <span className="text-slate-500">{completedTasks.size}/{riskReport.nextSteps?.length || 0} Done</span>
                                     </div>
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteCase('current', e)}
                                    className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    title="Delete/Reset Current Case"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              )}

                              {/* Saved Cases */}
                              {savedCases.map(c => (
                                <div 
                                  key={c.id} 
                                  className="relative group cursor-grab active:cursor-grabbing"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, c.id)}
                                >
                                  <button 
                                    onClick={() => { setSelectedCaseId(c.id); setSelectedDate(null); }}
                                    className={`w-full text-left p-3 rounded-xl border transition-all pr-8 ${selectedCaseId === c.id ? 'bg-white border-violet-400 shadow-md ring-1 ring-violet-200' : 'bg-white border-slate-200 hover:border-violet-300'}`}
                                  >
                                     <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700 truncate">{getAllApplicantNames(c.loanData)}</span>
                                     </div>
                                     <div className="flex items-center gap-2 text-xs">
                                       <span className={`w-2 h-2 rounded-full shrink-0 ${c.completedTasks.size === (c.riskReport.nextSteps?.length || 0) ? 'bg-emerald-500' : (c.completedTasks.size > 0 ? 'bg-orange-500' : 'bg-red-500')}`}></span>
                                       <span className="text-slate-500">{c.completedTasks.size}/{c.riskReport.nextSteps?.length || 0} Done</span>
                                     </div>
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteCase(c.id, e)}
                                    className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Case"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}

                              {savedCases.length === 0 && (!riskReport || !metrics) && (
                                <div className="text-slate-400 text-sm text-center py-10 italic">No cases found.</div>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Calendar Grid OR Details */}
                     <div className="lg:col-span-3">
                        {selectedCaseId ? (
                           renderSelectedCaseDetails()
                        ) : selectedDate ? (
                           renderDayDetails()
                        ) : (
                           <div>
                              <div className="grid grid-cols-7 gap-4 mb-2 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                                 <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                              </div>
                              <div className="grid grid-cols-7 gap-3">
                                 {renderCalendarDays()}
                              </div>
                              <div className="mt-6 bg-violet-50 rounded-2xl p-4 border border-violet-100 flex items-center justify-center text-violet-700 text-sm font-medium">
                                 <span className="mr-2">💡</span> Select a day on the calendar or drag & drop an applicant to reschedule.
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
             </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Input Column - Only show on Input Tab */}
            <div className={`lg:col-span-5 space-y-6 ${activeTab === 'input' ? 'animate-fadeIn' : 'hidden'}`}>
              
              {/* Multi-File Upload Card */}
              <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 shadow-soft border border-white transform transition hover:shadow-glow duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <CloudArrowUpIcon className="h-5 w-5 text-violet-500" />
                    Document Ingestion
                  </h3>
                  <span className="text-xs bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700 px-3 py-1 rounded-full font-bold shadow-sm">AI Powered</span>
                </div>

                <div className="relative group">
                  <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-violet-200 rounded-3xl cursor-pointer bg-violet-50/30 hover:bg-violet-50 transition-all group-hover:border-violet-400 group-hover:scale-[1.02] duration-300">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                         {isParsing ? (
                              <ArrowPathIcon className="h-10 w-10 text-violet-600 animate-spin" />
                            ) : (
                              <ArrowPathIcon className="h-10 w-10 text-violet-400 group-hover:text-violet-600 transition-colors" />
                            )}
                        <div className="text-center">
                          <span className="text-sm font-semibold group-hover:text-violet-700 block">
                            {isParsing ? "Analyzing docs..." : "Upload Case Files"}
                          </span>
                          <span className="text-xs text-slate-400 block mt-1">(Drag multiple PDFs/Images)</span>
                        </div>
                    </div>
                    <input 
                      key={fileInputKey}
                      id="file-upload" 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.png,.jpg,.jpeg" 
                      multiple 
                      onChange={handleFileUpload} 
                      disabled={isParsing} 
                    />
                  </label>
                </div>
                
                {/* File List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {uploadedFiles.map((f, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                        <DocumentTextIcon className="h-3 w-3" /> {f.name.slice(0, 15)}...
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 flex justify-end">
                   <button onClick={loadSampleData} className="text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors underline decoration-dotted underline-offset-2">
                     Load Sample Case (Joint)
                   </button>
                </div>
                {parseError && <p className="text-xs text-red-500 mt-2 text-center bg-red-50 p-2 rounded-lg font-medium">{parseError}</p>}
              </div>

              {/* Form Groups */}
              <div className="space-y-6">
                
                {/* Property Details */}
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white/50">
                   <div className="flex items-center gap-3 mb-6 text-slate-800">
                      <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 shadow-sm">
                        <HomeModernIcon className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-xl tracking-tight">Property</h3>
                   </div>
                   
                   <div className="space-y-5">
                      <div className="group">
                        <label className="text-xs font-extrabold text-slate-400 ml-1 uppercase tracking-wide">Address</label>
                        <div className="relative mt-1 flex gap-2">
                          <input 
                            type="text" 
                            name="propertyAddress" 
                            value={loanData.propertyAddress} 
                            onChange={handleInputChange} 
                            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-4 text-slate-700 font-bold focus:border-violet-400 focus:bg-white focus:outline-none transition-all shadow-inner" 
                            placeholder="Postcode or Address..." 
                          />
                          <button
                            onClick={handleAreaSearch}
                            disabled={isSearchingArea || !loanData.propertyAddress}
                            className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                            title="Check Area Value"
                          >
                             {isSearchingArea ? <ArrowPathIcon className="h-6 w-6 animate-spin" /> : <MagnifyingGlassIcon className="h-6 w-6" />}
                          </button>
                        </div>
                      </div>

                      {areaValuation && (
                        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-5 border border-indigo-100 animate-fadeIn text-sm shadow-sm relative overflow-hidden">
                           <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2 relative z-10">
                             <SparklesIcon className="h-5 w-5 text-indigo-500" /> Market Insights
                           </h4>
                           <p className="text-slate-700 leading-snug mb-3 relative z-10">{areaValuation.summary}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Value (OMV)" name="propertyValue" value={loanData.propertyValue} onChange={handleInputChange} prefix="£" />
                        <InputGroup label="Purchase Price" name="purchasePrice" value={loanData.purchasePrice} onChange={handleInputChange} prefix="£" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Refurb Cost" name="refurbCost" value={loanData.refurbCost} onChange={handleInputChange} prefix="£" />
                        <div className="group">
                           <label className="text-xs font-extrabold text-slate-400 ml-1 uppercase tracking-wide">Loan Type</label>
                           <select name="loanType" value={loanData.loanType} onChange={handleInputChange} 
                              className="w-full mt-1 bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-4 text-slate-700 font-bold focus:border-violet-400 focus:bg-white focus:outline-none transition-all shadow-inner appearance-none cursor-pointer">
                              {Object.values(LoanType).map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Terms (Collapsed) */}
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white/50">
                   <div className="grid grid-cols-3 gap-4">
                      <InputGroup label="Loan Amount" name="loanAmount" value={loanData.loanAmount} onChange={handleInputChange} prefix="£" className="col-span-3" />
                      <InputGroup label="Rate (pm)" name="interestRateMonthly" value={loanData.interestRateMonthly} onChange={handleInputChange} suffix="%" />
                      <InputGroup label="Term" name="termMonths" value={loanData.termMonths} onChange={handleInputChange} suffix="mths" className="col-span-2" />
                   </div>
                   
                    <div className="bg-fuchsia-50 p-4 rounded-2xl border-2 border-fuchsia-100/50 mt-4">
                        <label className="text-xs font-extrabold text-fuchsia-500 ml-1 uppercase mb-2 block tracking-wide">Exit Strategy</label>
                        <select name="exitStrategy" value={loanData.exitStrategy} onChange={handleInputChange} 
                              className="w-full bg-white border-none rounded-xl py-3 px-4 text-fuchsia-900 font-bold focus:ring-2 focus:ring-fuchsia-400 shadow-sm cursor-pointer">
                              {Object.values(ExitStrategy).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                {/* New Joint Borrower Section */}
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white/50">
                   <div className="flex items-center justify-between mb-6 text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="bg-fuchsia-100 p-3 rounded-2xl text-fuchsia-600 shadow-sm">
                          <UsersIcon className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-xl tracking-tight">Borrower(s)</h3>
                      </div>
                      <button 
                        onClick={addApplicant}
                        className="text-xs flex items-center gap-1 bg-fuchsia-50 text-fuchsia-600 px-3 py-1.5 rounded-lg hover:bg-fuchsia-100 transition-colors font-bold"
                      >
                         <UserPlusIcon className="h-4 w-4" /> Add
                      </button>
                   </div>
                   
                   {/* Applicant Tabs */}
                   <div className="flex gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">
                     {loanData.applicants.map((app, index) => (
                       <button
                         key={app.id || index}
                         onClick={() => setActiveApplicantIndex(index)}
                         className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeApplicantIndex === index ? 'bg-fuchsia-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                       >
                         {app.name || `Applicant ${index + 1}`}
                       </button>
                     ))}
                   </div>

                   {/* Active Applicant Form */}
                   {renderActiveApplicantForm()}
                </div>

                <button 
                    onClick={handleGenerateReport}
                    disabled={isAnalyzing}
                    className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white shadow-xl shadow-fuchsia-300 transition-all hover:scale-[1.02] hover:shadow-fuchsia-400 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <div className="relative flex items-center justify-center gap-3 font-bold text-xl tracking-tight">
                      {isAnalyzing ? (
                        <>
                          <ArrowPathIcon className="h-6 w-6 animate-spin" />
                          <span>Crunching Numbers...</span>
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="h-6 w-6 animate-bounce" />
                          <span>Analyze & Generate Report</span>
                        </>
                      )}
                    </div>
                  </button>

              </div>
            </div>

            {/* Right Column: Report/Dashboard - Show on Input or Report, but hide on Calendar */}
            <div className={`lg:col-span-7 space-y-8 ${(activeTab === 'input' || activeTab === 'report') ? 'animate-fadeIn' : 'hidden'}`}>
               <div className={`${activeTab === 'input' ? 'hidden lg:block' : 'block'}`}>
                  {/* Metrics Header */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                        <p className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-1">LTV</p>
                        <p className="text-4xl font-extrabold tracking-tight">{metrics ? metrics.ltv.toFixed(1) : '0.0'}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                        <p className="text-pink-100 text-sm font-bold uppercase tracking-wider mb-1">LTC</p>
                        <p className="text-4xl font-extrabold tracking-tight">{metrics ? metrics.ltc.toFixed(1) : '0.0'}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                        <p className="text-emerald-50 text-sm font-bold uppercase tracking-wider mb-1">Gross Loan</p>
                        <p className="text-2xl font-extrabold tracking-tight">{metrics ? formatCurrency(metrics.grossLoan) : '£0'}</p>
                    </div>
                  </div>

                  {/* Chart Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {metrics && (
                      <LTVChart 
                        metrics={metrics} 
                        propertyValue={loanData.propertyValue} 
                        loanAmount={loanData.loanAmount} 
                      />
                    )}
                    {riskReport ? (
                      <RiskGauge score={riskReport.score} />
                    ) : (
                      <div className="h-72 bg-white/10 backdrop-blur-md rounded-[2rem] border-2 border-dashed border-white/30 flex flex-col items-center justify-center text-white/60">
                        <ShieldCheckIcon className="h-16 w-16 mb-4 opacity-50" />
                        <span className="text-lg font-bold">Awaiting Analysis</span>
                      </div>
                    )}
                  </div>

                  {/* Memo Paper */}
                  <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-100">
                    <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                          <DocumentTextIcon className="h-6 w-6 text-violet-600" /> Underwriting Memo
                        </h2>
                      </div>
                      
                      {riskReport && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleSyncCRM}
                            disabled={isSyncingCRM}
                            className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                          >
                            {isSyncingCRM ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ServerStackIcon className="h-4 w-4" />}
                            Sync CRM
                          </button>
                          <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPdf}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg"
                          >
                            {isGeneratingPdf ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowDownTrayIcon className="h-4 w-4" />}
                            Export
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-8 min-h-[300px]">
                      {riskReport ? (
                        <div className="space-y-8 animate-fadeIn">
                          
                          {/* Summary */}
                          <div className="bg-violet-50 rounded-3xl p-6 border border-violet-100">
                              <h3 className="text-violet-900 font-bold mb-3">Executive Summary</h3>
                              <p className="text-slate-700 leading-relaxed font-medium">{riskReport.summary}</p>
                          </div>

                          {/* Risks / Mitigations */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Key Risks
                                </h4>
                                <ul className="space-y-2">
                                  {riskReport.risks.map((risk, idx) => (
                                    <li key={idx} className="bg-red-50 p-3 rounded-xl text-slate-700 text-sm font-medium">{risk}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Mitigations
                                </h4>
                                <ul className="space-y-2">
                                  {riskReport.mitigations.map((mit, idx) => (
                                    <li key={idx} className="bg-emerald-50 p-3 rounded-xl text-slate-700 text-sm font-medium">{mit}</li>
                                  ))}
                                </ul>
                              </div>
                          </div>

                          {/* Interactive Action Plan */}
                          <div className="border-t-2 border-slate-100 pt-8 mt-8">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
                                  <ClipboardDocumentCheckIcon className="h-6 w-6 text-fuchsia-500" /> 
                                  Action Plan
                                </h4>
                                <div className="flex gap-2">
                                  <button onClick={(e) => handleCalendarInvite(getAllApplicantNames(loanData), riskReport.score, e)} className="text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                                    <CalendarDaysIcon className="h-4 w-4" /> Add Follow-up
                                  </button>
                                  <button onClick={(e) => handleGenerateLetter(getMainApplicantName(loanData), riskReport.nextSteps, loanData.propertyAddress, e)} className="text-xs flex items-center gap-1 bg-violet-100 hover:bg-violet-200 text-violet-700 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                                    <DocumentDuplicateIcon className="h-4 w-4" /> Request All Info
                                  </button>
                                </div>
                              </div>
                              
                              <div className="bg-slate-50 rounded-3xl p-2 border border-slate-100">
                                {riskReport.nextSteps.map((step, idx) => (
                                  <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer group ${completedTasks.has(step) ? 'bg-emerald-50/50' : 'hover:bg-white hover:shadow-sm'}`} onClick={() => handleTaskToggle(step)}>
                                    {/* Checkbox */}
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${completedTasks.has(step) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                                        {completedTasks.has(step) && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    
                                    <div className="flex-1">
                                        <span className={`font-medium transition-colors ${completedTasks.has(step) ? 'text-emerald-800 line-through decoration-emerald-300' : 'text-slate-600'}`}>
                                          {step}
                                        </span>
                                        <button 
                                          onClick={(e) => handleGenerateLetter(getMainApplicantName(loanData), step, loanData.propertyAddress, e)}
                                          className="text-xs text-violet-500 hover:text-violet-700 font-bold block mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <EnvelopeIcon className="h-3 w-3" /> Generate Letter
                                        </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                          </div>

                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                          <DocumentTextIcon className="h-24 w-24 text-slate-300 mb-4" />
                          <p className="text-xl font-bold text-slate-400">Ready to Analyze</p>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>

        {/* Floating Chat Bot - Fixed Position & Z-Index */}
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
          <div className="pointer-events-auto">
            {/* Chat Window */}
            {chatOpen && (
              <div className="bg-white rounded-[2rem] shadow-2xl w-80 sm:w-96 h-[30rem] flex flex-col border border-slate-200 overflow-hidden animate-fadeIn mb-4">
                <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-4 flex justify-between items-center text-white">
                  <h3 className="font-bold flex items-center gap-2"><SparklesIcon className="h-4 w-4" /> Underwriter Assistant</h3>
                  <button onClick={() => setChatOpen(false)} className="hover:bg-white/20 rounded-full p-1"><XMarkIcon className="h-5 w-5" /></button>
                </div>
                
                <div className="flex-1 bg-slate-50 p-4 overflow-y-auto custom-scrollbar space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-slate-400 text-sm mt-10 px-4">
                      <p>Ask me about the loan application, market data, or missing documents.</p>
                    </div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${msg.sender === 'user' ? 'bg-violet-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatThinking && (
                    <div className="flex justify-start">
                      <div className="bg-white text-slate-500 border border-slate-100 rounded-2xl rounded-bl-none p-3 text-xs flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                    className="flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="Ask a question..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={!chatInput.trim() || isChatThinking} className="bg-violet-600 text-white p-2 rounded-xl hover:bg-violet-700 disabled:opacity-50">
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </form>
              </div>
            )}

            {/* Chat Trigger Button */}
            <button 
              onClick={() => setChatOpen(!chatOpen)}
              className="bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 group"
            >
              <ChatBubbleLeftRightIcon className="h-7 w-7 group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
};

// Reusable Input Component
const InputGroup: React.FC<{
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  placeholder?: string;
}> = ({ label, name, value, onChange, type = "text", prefix, suffix, className = "", placeholder }) => (
  <div className={`group ${className}`}>
    <label className="text-xs font-extrabold text-slate-400 ml-1 uppercase tracking-wide">{label}</label>
    <div className="relative mt-1">
      {prefix && <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold">{prefix}</div>}
      <input 
        type={typeof value === 'number' ? 'number' : type} 
        name={name} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
        className={`w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 text-slate-700 font-bold focus:border-violet-400 focus:bg-white focus:outline-none transition-all shadow-inner placeholder-slate-300
          ${prefix ? 'pl-8' : 'pl-4'} ${suffix ? 'pr-12' : 'pr-4'}`} 
      />
      {suffix && <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 font-bold text-xs uppercase">{suffix}</div>}
    </div>
  </div>
);

export default App;