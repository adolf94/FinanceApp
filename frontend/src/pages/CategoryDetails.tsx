import { useState, useMemo } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useGetAccounts, useGetAccountGroups } from '@/hooks/useAccounts'
import { useGetTransactions, Transaction } from '@/hooks/useTransactions'
import { ArrowLeft, ArrowDownRight, ArrowUpRight, ArrowRightLeft, BookOpen, Pencil } from 'lucide-react'
import AddTransactionModal from '@/components/AddTransactionModal'

export default function CategoryDetails() {
  const { categoryId } = useParams({ from: '/categories/$categoryId' })
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccounts()
  const { data: groups = [], isLoading: isLoadingGroups } = useGetAccountGroups()
  const { data: transactions = [], isLoading: isLoadingTx } = useGetTransactions(undefined, undefined, categoryId)

  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const group = groups.find(g => g.id === categoryId)

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name ?? 'Unknown Account'
  }

  // Calculate total category impact from transactions
  const totalAmount = useMemo(() => {
    if (!group || transactions.length === 0) return 0
    let total = 0
    transactions.forEach(tx => {
      tx.entries.forEach(entry => {
        const acc = accounts.find(a => a.id === entry.accountId)
        if (acc && acc.accountGroupId === categoryId) {
          total += entry.amount
        }
      })
    })
    return total
  }, [transactions, categoryId, group, accounts])

  // Process transactions: sort, sum their specific impact on this Category Group
  const processedTransactions = useMemo(() => {
    if (!group || transactions.length === 0) return []

    // Sort transactions newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return sorted.map(tx => {
      // Find entries belonging to accounts in this group
      const groupEntries = tx.entries.filter(e => {
        const acc = accounts.find(a => a.id === e.accountId)
        return acc && acc.accountGroupId === categoryId
      })
      // Sum the impact
      const impact = groupEntries.reduce((sum, e) => sum + e.amount, 0)

      return {
        ...tx,
        impact
      }
    })
  }, [group, transactions, accounts, categoryId])

  // Group by day
  const groupedData = useMemo(() => {
    const days: { dateStr: string, transactions: typeof processedTransactions }[] = []
    let currentDayStr: string | null = null
    let currentDayTx: typeof processedTransactions = []

    processedTransactions.forEach(tx => {
      const d = new Date(tx.date)
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

      if (dateStr !== currentDayStr) {
        if (currentDayStr && currentDayTx.length > 0) {
          days.push({ dateStr: currentDayStr, transactions: currentDayTx })
        }
        currentDayStr = dateStr
        currentDayTx = [tx]
      } else {
        currentDayTx.push(tx)
      }
    })

    if (currentDayStr && currentDayTx.length > 0) {
      days.push({ dateStr: currentDayStr, transactions: currentDayTx })
    }

    return days
  }, [processedTransactions])

  if (isLoadingAccounts || isLoadingGroups || isLoadingTx) {
    return <div className="p-4 text-slate-500">Loading category details...</div>
  }

  if (!group) {
    return <div className="p-4 text-rose-500">Category not found.</div>
  }

  const isExpense = group.accountType === 'Expense'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{group.name}</h1>
        </div>
        <div className="flex justify-between items-end mt-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {group.accountType} Category Group
          </span>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 mb-0.5">Total {isExpense ? 'Spent' : 'Received'}</p>
            <p className={`text-lg font-bold ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
              ₱{Math.abs(totalAmount).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto">
        {processedTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic">No transactions in this category.</div>
        ) : (
          <div className="bg-white dark:bg-slate-900 shadow-sm border-y border-slate-200 dark:border-slate-800">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-500 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div className="col-span-6">Details</div>
              <div className="col-span-3">Sub-Category</div>
              <div className="col-span-3 text-right">Amount</div>
            </div>

            {/* Rows */}
            <div className="pb-8">
              {groupedData.map((dayGroup) => (
                <div key={dayGroup.dateStr} className="mb-4">
                  <div className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur px-4 py-1.5 border-y border-slate-200 dark:border-slate-800 sticky top-[44px] z-0">
                    <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dayGroup.dateStr}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    {dayGroup.transactions.map((tx) => {
                      // Determine the subcategory
                      const groupEntries = tx.entries.filter(e => {
                        const acc = accounts.find(a => a.id === e.accountId)
                        return acc && acc.accountGroupId === categoryId
                      })
                      const subCategoryName = groupEntries.length > 0
                        ? getAccountName(groupEntries[0].accountId)
                        : 'Unknown'

                      // For display, get other accounts
                      const otherEntries = tx.entries.filter(e => {
                        const acc = accounts.find(a => a.id === e.accountId)
                        return !acc || acc.accountGroupId !== categoryId
                      })
                      const otherAccountName = otherEntries.length === 1
                        ? getAccountName(otherEntries[0].accountId)
                        : otherEntries.length > 1
                        ? 'Split'
                        : 'Self'

                      return (
                        <li key={tx.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          {/* Details */}
                          <div className="col-span-6 flex items-center gap-3 overflow-hidden">
                            <div
                              className={`shrink-0 p-1.5 rounded-full ${
                                tx.type === 'Income'
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                  : tx.type === 'Expense'
                                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                  : tx.type === 'Journal'
                                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                                  : 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                              }`}
                            >
                              {tx.type === 'Income' && <ArrowUpRight className="w-4 h-4" />}
                              {tx.type === 'Expense' && <ArrowDownRight className="w-4 h-4" />}
                              {tx.type === 'Transfer' && <ArrowRightLeft className="w-4 h-4" />}
                              {tx.type === 'Journal' && <BookOpen className="w-4 h-4" />}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                                {tx.vendor ? tx.vendor : tx.type === 'Journal' ? 'Journal Entry' : otherAccountName}
                              </p>
                              {tx.note && <p className="text-xs text-slate-600 dark:text-slate-300 italic truncate mt-0.5">{tx.note}</p>}
                            </div>
                          </div>

                          {/* Sub-Category */}
                          <div className="col-span-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                            {subCategoryName}
                          </div>

                          {/* Amount */}
                          <div className="col-span-3 flex items-center justify-end gap-2 text-right text-xs font-semibold">
                            <span className={tx.impact > 0 ? 'text-emerald-600 dark:text-emerald-400' : tx.impact < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}>
                              {tx.impact > 0 ? '+' : ''}{tx.impact === 0 ? '0.00' : tx.impact.toFixed(2)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                              className="p-1 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                              aria-label="Edit transaction"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddTransactionModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        initialData={editingTx}
      />
    </div>
  )
}
