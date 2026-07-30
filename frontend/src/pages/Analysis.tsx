import { useState } from 'react'
import dayjs from 'dayjs'
import { useAnalysis } from '@/hooks/useAnalysis'
import { Link } from '@tanstack/react-router'
import { Loader2, TrendingUp, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function Analysis() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs())
  const { spendingByCategoryChartData, categoryGroupBreakdown, monthlyBarChartData, goalProgress, isLoading } = useAnalysis(selectedMonth)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Analysis</h1>
          <p className="text-slate-500 mt-1 text-sm">Insights and spending charts</p>
        </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button 
            onClick={() => setSelectedMonth(prev => prev.subtract(1, 'month'))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <span className="font-semibold text-slate-900 dark:text-slate-50 min-w-[120px] text-center">
            {selectedMonth.format('MMMM YYYY')}
          </span>
          <button 
            onClick={() => setSelectedMonth(prev => prev.add(1, 'month'))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </header>

      {/* Goal Tracking */}
      <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50 font-semibold">
            <Target className="w-5 h-5 text-blue-500" />
            <h2>Savings Goal Progress</h2>
          </div>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{goalProgress}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 overflow-hidden">
          <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${goalProgress}%` }}></div>
        </div>
        <p className="text-xs text-slate-500">You are on track to hit your year-end savings goal!</p>
      </section>

      {/* Spending by Category Pie Chart */}
      <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">{selectedMonth.format('MMMM')} Spending</h2>
        {spendingByCategoryChartData.length === 0 ? (
           <p className="text-sm text-slate-500 text-center py-10">No expenses recorded this month.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendingByCategoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {spendingByCategoryChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value: any) => `₱${Number(value).toLocaleString()}`}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Spending Breakdown List */}
      {categoryGroupBreakdown && categoryGroupBreakdown.length > 0 && (
        <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Spending Breakdown</h2>
          <div className="flex flex-col gap-4">
            {categoryGroupBreakdown.map((group) => (
              <div key={group.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between items-center mb-2">
                  <Link 
                    to="/categories/$categoryId" 
                    params={{ categoryId: group.id }}
                    className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {group.name}
                  </Link>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pl-4 flex flex-col gap-1.5 border-l border-slate-100 dark:border-slate-800 ml-1">
                  {group.subcategories.map((sub) => (
                    <div key={sub.id} className="flex justify-between items-center text-sm">
                      <Link
                        to="/accounts/$accountId"
                        params={{ accountId: sub.id }}
                        className="text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        {sub.name}
                      </Link>
                      <span className="text-slate-600 dark:text-slate-400">
                        ₱{sub.total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Income vs Expense Bar Chart */}
      <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-50 font-semibold">
           <TrendingUp className="w-5 h-5 text-emerald-500" />
           <h2>Cash Flow (6 Months)</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyBarChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `₱${value/1000}k`} />
              <Tooltip 
                 formatter={(value: any) => `₱${Number(value).toLocaleString()}`}
                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 cursor={{fill: 'transparent'}}
              />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  )
}
