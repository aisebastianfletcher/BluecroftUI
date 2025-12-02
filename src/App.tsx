import React, { useState, useEffect, useRef } from 'react';
import { LoanData, LoanType, CalculatedMetrics, RiskReport, ExitStrategy, AreaValuation, AuditLogEntry, ChatMessage, UploadedFile, CaseRecord, Applicant } from './types';
import { parseDocument, generateRiskAnalysis, checkAreaValuation, askUnderwriterAI } from './services/geminiService';
import { generatePDFReport, generateRequestLetter, generateCalendarEvent } from './utils/pdfGenerator';
import { LTVChart, RiskGauge } from './components/Charts';
import { 
  CalculatorIcon, 
  DocumentTextIcon, 
  ArrowPathIcon, 
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  HomeModernIcon,
  UserCircleIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  PlusIcon,
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
  BellAlertIcon,
  FolderPlusIcon,
  ShieldCheckIcon
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

  const getTaskDueDate = (c: CaseRecord | { loanData: LoanData, createdAt: Date }, task: string): Date => {
    if (c.loanData.taskDueDates && c.loanData.taskDueDates[task]) {
      return new Date(c.loanData.taskDueDates[task]);
    }
    if ('scheduledDate' in c && c.scheduledDate) {
      return new Date(c.scheduledDate);
    }
    if (c.loanData.scheduledDate) {
      return new Date(c.loanData.scheduledDate);
    }
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
    if (!newApplicants[index]) return;
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
      
      setLoanData(prev => {
         const mergedApplicants = extractedData.applicants && extractedData.applicants.length > 0 
            ? extractedData.applicants.map((a, i) => ({ ...DEFAULT_APPLICANT, id: `${Date.now()}-${i}`, ...a }))
            : prev.applicants;
         return { ...prev, ...extractedData, applicants: mergedApplicants };
      });

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
         setCurrentSessionDate(new Date()); 
         if (selectedCaseId === 'current') setSelectedCaseId(null);
         addAuditLog('System', 'Deleted/Reset current active case.');
      } else {
         setSavedCases(prev => prev.filter(c => c.id !== id));
         if (selectedCaseId === id) setSelectedCaseId(null);
         addAuditLog('System', 'Deleted case record.');
      }
    }
  };

  const handleRescheduleStart = (caseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReschedulingCaseId(caseId);
    setReschedulingTask(null);
    setSelectedDate(null);
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

  const handleDragStart = (e: React.DragEvent, caseId: string, task?: string) => {
    e.dataTransfer.effectAllowed = "move";
    if (task) {
      setDraggedTask({ caseId, task });
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("caseId", caseId);
      e.dataTransfer.setData("task", task);
    } else {
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
      scheduledDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), 
      taskDueDates: {}
    });
    addAuditLog('System', 'Loaded sample dataset with Joint Applicants.');
  };

  const handleSaveAndNew = () => {
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
    setCurrentSessionDate(new Date()); 
    addAuditLog('System', 'Started new case.');
  };

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
        createdAt: currentSessionDate,
        scheduledDate: loanData.scheduledDate
      }] : []),
      ...savedCases
    ];
  };

  const getCasesDueOnDate = (date: Date) => {
     return getAllCases().filter(c => {
        if (c.loanData.taskDueDates) {
           const hasTaskToday = Object.values(c.loanData.taskDueDates).some(dStr => {
              const d = new Date(dStr);
              return d.getDate() === date.getDate() && 
                     d.getMonth() === date.getMonth() &&
                     d.getFullYear() === date.getFullYear();
           });
           if (hasTaskToday) return true;
        }

        let baseDueDate: Date;
        if (c.scheduledDate) {
          baseDueDate = new Date(c.scheduledDate);
        } else {
          baseDueDate = new Date(c.createdAt);
          baseDueDate.setDate(baseDueDate.getDate() + 1);
        }
        
        const matchesBase = baseDueDate.getDate() === date.getDate() && 
                            baseDueDate.getMonth() === date.getMonth() && 
                            baseDueDate.getFullYear() === date.getFullYear();
        if (matchesBase) return true; 
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
             <InputGroup label="Annual Income" name="annualIncome" value={app.annualIncome} onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} prefix="£" type="number" />
             <InputGroup label="Monthly Expenses" name="monthlyExpenses" value={app.monthlyExpenses} onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} prefix="£" type="number" />
         </div>
         <div className="grid grid-cols-2 gap-4">
             <InputGroup label="Total Assets" name="totalAssets" value={app.totalAssets} onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} prefix="£" type="number" />
             <InputGroup label="Total Liabilities" name="totalLiabilities" value={app.totalLiabilities} onChange={(e) => handleApplicantChange(activeApplicantIndex, e)} prefix="£" type="number" />
         </div>
      </div>
    );
  };

  const renderCalendarDays = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100/50 rounded-xl opacity-50"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(today.getFullYear(), today.getMonth(), i);
      const isToday = i === today.getDate();
      const casesDue = getCasesDueOnDate(currentDate);
      
      let totalTasks = 0;
      let totalPending = 0;

      casesDue.forEach(c => {
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
                 
                 const tasksForDate = nextSteps.filter(task => {
                    const due = getTaskDueDate(c, task);
                    return due.getDate() === selectedDate.getDate() && due.getMonth() === selectedDate.getMonth();
                 });

                 const totalCount = tasksForDate.length;
                 const completedCount = tasksForDate.filter(t => c.completedTasks.has(t)).length;

                 return (
                   <div key={c.id} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300">
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

                      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="p-4 pt-0 border-t border-slate-200/50 bg-white/50 space-y-2 overflow-y-auto max-h-[400px] custom-scrollbar">
                           <div className="h-2"></div>
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
           scheduledDate: loanData.scheduledDate!
        };
        isCurrent = true;
      }
    } else {
      activeCase = savedCases.find(c => c.id === selectedCaseId) || null;
    }

    if (!activeCase) return null;

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
               const due = getTaskDueDate(activeCase!, step);
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
