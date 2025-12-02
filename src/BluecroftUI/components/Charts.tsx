
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { CalculatedMetrics } from '../types';

interface ChartsProps {
  metrics: CalculatedMetrics;
  propertyValue: number;
  loanAmount: number;
}

export const LTVChart: React.FC<ChartsProps> = ({ metrics, propertyValue, loanAmount }) => {
  const data = [
    {
      name: 'Capital Stack',
      Loan: loanAmount,
      Equity: Math.max(0, propertyValue - loanAmount),
    },
  ];

  return (
    <div id="ltv-chart-container" className="h-72 w-full bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-soft border border-white/60">
      <h3 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Capital Structure</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} hide />
          <Tooltip 
            formatter={(value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)}
            cursor={{fill: 'transparent'}}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {/* Vibrant Blue/Purple for Loan */}
          <Bar dataKey="Loan" stackId="a" fill="#6366f1" radius={[8, 0, 0, 8]} barSize={40} />
          {/* Soft Gray/Blue for Equity */}
          <Bar dataKey="Equity" stackId="a" fill="#cbd5e1" radius={[0, 8, 8, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];
  
  // Vibrant Color scale
  const getColor = (s: number) => {
    if (s >= 80) return '#10b981'; // Emerald-500
    if (s >= 60) return '#f59e0b'; // Amber-500
    return '#ef4444'; // Red-500
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Low Risk';
    if (s >= 60) return 'Moderate Risk';
    if (s >= 40) return 'High Risk';
    return 'Critical';
  };

  return (
    <div id="risk-gauge-container" className="h-72 w-full bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-soft border border-white/60 flex flex-col items-center justify-center relative">
      <h3 className="text-sm font-bold text-slate-600 absolute top-6 left-6 uppercase tracking-wider">AI Risk Score</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={95}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="cell-0" fill={getColor(score)} />
            <Cell key="cell-1" fill="#f1f5f9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-6 flex flex-col items-center">
        <span className="text-4xl font-extrabold text-slate-800" style={{ color: getColor(score) }}>{score}</span>
        <span className="text-sm font-bold mt-1 px-3 py-1 rounded-full bg-slate-100" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </span>
      </div>
    </div>
  );
};
