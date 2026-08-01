import { useState } from 'react'
import { useGetTransactions, useDeleteTransaction, Transaction } from '@/hooks/useTransactions'
import { useGetAccounts } from '@/hooks/useAccounts'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Trash2, BookOpen, ChevronLeft, ChevronRight, Pencil, List, CalendarDays, RotateCw } from 'lucide-react'
import dayjs from 'dayjs'
import AddTransactionModal from '@/components/AddTransactionModal'
import CalendarView from '@/pages/CalendarView'
import RecurringTransactionsList from '@/components/RecurringTransactionsList'
import ConfirmationModal from '@/components/ui/ConfirmationModal'


type ViewMode = 'daily' | 'month' | 'recurring'

export default function Transactions() {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'))
  const [view, setView] = useState<ViewMode>('daily')

  const startDate = currentMonth.format('YYYY-MM-DD')
  const endDate = currentMonth.endOf('month').format('YYYY-MM-DD')

  const { data: transactions = [], isLoading } = useGetTransactions(startDate, endDate)
  const { data: accounts = [] } = useGetAccounts()
  const deleteMutation = useDeleteTransaction()

  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  


  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name ?? 'Unknown Account'
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Transactions</h1>
          <p className="text-slate-500 mt-1 text-sm">Monthly Log</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(prev => prev.subtract(1, 'month'))}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5"/>
          </button>
          <span className="font-semibold text-slate-800 dark:text-slate-100 min-w-[130px] text-center">
            {currentMonth.format('MMMM YYYY')}
          </span>
          <button
            onClick={() => setCurrentMonth(prev => prev.add(1, 'month'))}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* View Toggle — Daily | Month | Recurring */}
      <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 mx-3 mt-3 rounded-xl gap-1 shrink-0">
        <button
          onClick={() => setView('daily')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all cursor-pointer ${
            view === 'daily'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4" /> Daily
        </button>
        <button
          onClick={() => setView('month')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all cursor-pointer ${
            view === 'month'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> Month
        </button>
        <button
          onClick={() => setView('recurring')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all cursor-pointer ${
            view === 'recurring'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <RotateCw className="w-4 h-4" /> Recurring
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'recurring' ? (
          <RecurringTransactionsList />
        ) : view === 'month' ? (
          <CalendarView currentMonth={currentMonth} transactions={transactions} accounts={accounts} />
        ) : (
          /* Daily view content */<>
            {isLoading ? (
              <div className="p-4 text-slate-500 text-center mt-4">Loading transactions...</div>
            ) : transactions.length === 0 && !isLoading ? (
              <div className="p-8 text-center text-slate-400 italic">No transactions recorded yet.</div>
            ) : (
              <div className="pb-8">
                {Object.entries(
                  transactions.reduce((groups, tx) => {
                    const dateStr = new Date(tx.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    if (!groups[dateStr]) groups[dateStr] = []
                    groups[dateStr].push(tx)
                    return groups
                  }, {} as Record<string, typeof transactions>)
                ).map(([dateStr, dayTransactions]) => (
                  <div key={dateStr} className="mb-6">
                    <div className="sticky top-0 z-0 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur px-4 py-2 border-y border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dateStr}</h3>
                    </div>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                      {dayTransactions.map((tx) => (
                        <li key={tx.id} className="flex flex-col transition-colors duration-200">
                          <div
                            className="p-3 px-4 min-h-[60px] flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-full ${
                                  tx.type === 'Income'
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : tx.type === 'Expense'
                                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                    : tx.type === 'Journal'
                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                                    : 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                }`}
                              >
                                {tx.type === 'Income' && <ArrowUpRight className="w-5 h-5" />}
                                {tx.type === 'Expense' && <ArrowDownRight className="w-5 h-5" />}
                                {tx.type === 'Transfer' && <ArrowRightLeft className="w-5 h-5" />}
                                {tx.type === 'Journal' && <BookOpen className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="text-base font-medium text-slate-900 dark:text-slate-50 leading-tight">
                                  {tx.type === 'Transfer' ? (
                                    'Transfer'
                                  ) : tx.type === 'Journal' ? (
                                    'Journal Entry'
                                  ) : (
                                    tx.entries
                                      .filter(e => (tx.type === 'Expense' ? e.amount > 0 : e.amount < 0))
                                      .map(e => getAccountName(e.accountId))
                                      .join(', ') || 'Uncategorized'
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                  {
                                    tx.type === 'Transfer'
                                    ? tx.entries.map(e => getAccountName(e.accountId)).join(' ➔ ')
                                    : tx.type === 'Journal'
                                    ? `${tx.entries.length} splits`
                                    : getAccountName(tx.entries.find(e => tx.type === 'Expense' ? e.amount < 0 : e.amount > 0)?.accountId ?? '')
                                  }
                                  {tx.vendor && ` • Vendor: ${tx.vendor}`}
                                </p>
                                {tx.note && <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-0.5">{tx.note}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-base font-semibold mr-2 ${
                                  tx.type === 'Income'
                                    ? 'text-emerald-500'
                                    : tx.type === 'Expense'
                                    ? 'text-rose-500'
                                    : tx.type === 'Journal'
                                    ? 'text-purple-600 dark:text-purple-400'
                                    : 'text-slate-700 dark:text-slate-350'
                                }`}
                              >
                                {tx.type === 'Income' ? '+' : tx.type === 'Expense' ? '-' : ''}₱{
                                  (tx.entries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0)).toFixed(2)
                                }
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                                className="p-2 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                aria-label="Edit transaction"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteCandidate(tx.id!);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                aria-label="Delete transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Journal Entries */}
                          {tx.type === 'Journal' && (
                            <div className="bg-slate-50 dark:bg-slate-800/30 px-12 py-3 border-t border-slate-100 dark:border-slate-800">
                              <div className="grid grid-cols-12 text-xs font-semibold uppercase text-slate-500 mb-2 px-2">
                                <div className="col-span-6">Account</div>
                                <div className="col-span-3 text-right">Debit</div>
                                <div className="col-span-3 text-right">Credit</div>
                              </div>
                              <div className="flex flex-col gap-1">
                                {tx.entries.map((entry, idx) => (
                                  <div key={idx} className="grid grid-cols-12 text-sm text-slate-700 dark:text-slate-300 px-2 py-1 bg-white dark:bg-slate-800 rounded">
                                    <div className="col-span-6 font-medium truncate">{getAccountName(entry.accountId)}</div>
                                    <div className="col-span-3 text-right text-slate-900 dark:text-slate-100">
                                      {entry.amount > 0 ? `₱${entry.amount.toFixed(2)}` : ''}
                                    </div>
                                    <div className="col-span-3 text-right text-slate-900 dark:text-slate-100">
                                      {entry.amount < 0 ? `₱${Math.abs(entry.amount).toFixed(2)}` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      <AddTransactionModal
        isOpen={!!editingTx}
        onClose={() => {
          setEditingTx(null)
        }}
        initialData={editingTx}
      />

      <ConfirmationModal
        isOpen={!!deleteCandidate}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action is permanent and cannot be undone."
        onConfirm={() => {
          if (deleteCandidate) {
            deleteMutation.mutate(deleteCandidate)
            setDeleteCandidate(null)
          }
        }}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  )
}
