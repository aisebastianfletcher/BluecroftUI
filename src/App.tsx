import React, { useState, useEffect, useRef } from 'react';
import { LoanData, LoanType, CalculatedMetrics, RiskReport, ExitStrategy, AreaValuation, AuditLogEntry, ChatMessage, UploadedFile, CaseRecord, Applicant } from './types';
import { parseDocument, generateRiskAnalysis, checkAreaValuation, askUnderwriterAI } from './services/geminiService';
import { generatePDFReport, generateRequestLetter, generateCalendarEvent } from './utils/pdfGenerator';
import { LTVChart, RiskGauge } from './components/Charts';
import React, { useState } from 'react';
import {
  parseDocument,
  generateRiskAnalysis,
  checkAreaValuation,
  askUnderwriterAI,
  getRiskReport,
} from './services';

import type { GeminiResponse, ParsedDocument } from './services';

function ResultBlock({ title, content }: { title: string; content: any }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 12, marginTop: 12 }}>
      <strong>{title}</strong>
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
        {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

const App: React.FC = () => {
  const [docText, setDocText] = useState<string>('');
  const [loanJson, setLoanJson] = useState<string>('{ "amount": 100000, "termMonths": 12 }');
  const [location, setLocation] = useState<string>('London, UK');
  const [question, setQuestion] = useState<string>('What are the key underwriting risks?');

  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [lastReport, setLastReport] = useState<GeminiResponse | null>(null);
  const [lastValuation, setLastValuation] = useState<GeminiResponse | null>(null);
  const [lastAnswer, setLastAnswer] = useState<GeminiResponse | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setBusy(true);
    try {
      const p = await parseDocument(docText);
      setParsed(p);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRisk() {
    setError(null);
    setBusy(true);
    try {
      const loanObj = JSON.parse(loanJson);
      const r = await generateRiskAnalysis(loanObj);
      setLastReport(r);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleValuation() {
    setError(null);
    setBusy(true);
    try {
      const v = await checkAreaValuation(location);
      setLastValuation(v);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAsk() {
    setError(null);
    setBusy(true);
    try {
      const a = await askUnderwriterAI(question, { context: 'UI quick test' });
      setLastAnswer(a);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickReportPrompt() {
    setError(null);
    setBusy(true);
    try {
      const r = await getRiskReport('Quick report example prompt');
      setLastReport(r);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Bluecroft — AI test UI</h1>

      <section>
        <h2>Parse document</h2>
        <textarea
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          rows={6}
          style={{ width: '100%' }}
          placeholder="Paste document text here..."
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleParse} disabled={busy}>
            Parse document
          </button>
        </div>
        {parsed && <ResultBlock title="Parsed Document" content={parsed} />}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Generate risk analysis</h2>
        <textarea
          value={loanJson}
          onChange={(e) => setLoanJson(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleRisk} disabled={busy}>
            Generate risk analysis
          </button>{' '}
          <button onClick={handleQuickReportPrompt} disabled={busy}>
            Quick report prompt
          </button>
        </div>
        {lastReport && <ResultBlock title="Risk Analysis" content={lastReport} />}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Area valuation</h2>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleValuation} disabled={busy}>
            Check valuation
          </button>
        </div>
        {lastValuation && <ResultBlock title="Area Valuation" content={lastValuation} />}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Ask Underwriter AI</h2>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ width: '100%' }} />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleAsk} disabled={busy}>
            Ask
          </button>
        </div>
        {lastAnswer && <ResultBlock title="AI Answer" content={lastAnswer} />}
      </section>

      {error && (
        <div style={{ color: 'crimson', marginTop: 20 }}>
          <strong>Error:</strong>
          <pre>{error}</pre>
        </div>
      )}

      <footer style={{ marginTop: 28, color: '#666' }}>
        <small>Quick UI for exercising the geminiService exports used by the app.</small>
      </footer>
    </div>
  );
};

export default App;
