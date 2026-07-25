import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useGetAccounts, useGetAccountGroups, useCreateAccountGroup, useCreateAccount } from '@/hooks/useAccounts'
import { useGetVendors, useCreateVendor } from '@/hooks/useVendors'
import { useCreateTransaction, useUpdateTransaction, Transaction, LedgerEntry } from '@/hooks/useTransactions'
import { useCreateRecurringTransaction } from '@/hooks/useRecurringTransactions'
import { uuidv7 } from 'uuidv7'
import Combobox from './ui/Combobox'
import CalculatorInput from './ui/CalculatorInput'

const PRESET_VENDORS = [
  'Amazon',
  'Walmart',
  'Target',
  'Starbucks',
  'Uber',
  'Lyft',
  'Netflix',
  'Apple',
  'Google',
  "McDonald's",
  'Costco',
  'Shell',
  'Local Store',
  'Utility Company',
  'Other / Custom',
]

const generateId = () => uuidv7()

interface SplitLine {
  id: string
  categoryId: string // AccountGroup ID
  subCategoryId: string // Account ID
  amount: string
}

interface JournalLine {
  id: string
  categoryId: string
  subCategoryId: string
  amount: string
  type: 'Debit' | 'Credit'
}

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: Transaction | null
}

export default function AddTransactionModal({ isOpen, onClose, initialData }: AddTransactionModalProps) {
  const { data: accounts = [] } = useGetAccounts()
  const { data: accountGroups = [] } = useGetAccountGroups()
  const { data: dbVendors = [] } = useGetVendors()
  const createTxMutation = useCreateTransaction()
  const updateTxMutation = useUpdateTransaction()
  const createVendorMutation = useCreateVendor()
  const createRecurringTxMutation = useCreateRecurringTransaction()
  const createAccountGroupMutation = useCreateAccountGroup()
  const createAccountMutation = useCreateAccount()

  const [mode, setMode] = useState<'Simple' | 'Advanced'>('Simple')
  const submitTypeRef = useRef<'close'|'more'>('close')
  const [type, setType] = useState<'Income' | 'Expense' | 'Transfer'>('Expense')
  
  const [totalAmount, setTotalAmount] = useState('')
  const [sourceAccountId, setSourceAccountId] = useState('') // The payment account
  const [toAccountId, setToAccountId] = useState('') // Only used for Transfer
  
  // Splits
  const [splits, setSplits] = useState<SplitLine[]>([
    { id: generateId(), categoryId: '', subCategoryId: '', amount: '' }
  ])

  // Journal Lines
  const [journalLines, setJournalLines] = useState<JournalLine[]>([
    { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Debit' },
    { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Credit' }
  ])

  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Recurring options
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<'Daily'|'Weekly'|'Monthly'|'Yearly'>('Monthly')
  const [maxOccurrences, setMaxOccurrences] = useState('')

  const resetForm = useCallback(() => {
    setMode('Simple')
    setType('Expense')
    setTotalAmount('')
    setSourceAccountId('')
    setToAccountId('')
    setSplits([{ id: generateId(), categoryId: '', subCategoryId: '', amount: '' }])
    setJournalLines([
      { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Debit' },
      { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Credit' }
    ])
    setVendor('')
    setNote('')
    setDate(new Date().toISOString().split('T')[0])
    setIsRecurring(false)
    setFrequency('Monthly')
    setMaxOccurrences('')
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setMode(initialData.type === 'Journal' ? 'Advanced' : 'Simple')
        setType(initialData.type !== 'Journal' ? initialData.type : 'Expense')
        setDate(initialData.date.split('T')[0])
        setNote(initialData.note || '')
        setVendor(initialData.vendor || '')
        
        if (initialData.type === 'Journal') {
          setJournalLines(initialData.entries.map(e => {
            const acc = accounts.find(a => a.id === e.accountId)
            return {
              id: generateId(),
              categoryId: acc?.accountGroupId || '',
              subCategoryId: e.accountId,
              amount: Math.abs(e.amount).toString(),
              type: e.amount > 0 ? 'Debit' : 'Credit'
            }
          }))
        } else {
          // Simple mode decode
          if (initialData.type === 'Transfer') {
            const srcEntry = initialData.entries.find(e => e.amount < 0)
            const dstEntry = initialData.entries.find(e => e.amount > 0)
            if (srcEntry && dstEntry) {
              setSourceAccountId(srcEntry.accountId)
              setToAccountId(dstEntry.accountId)
              setTotalAmount(Math.abs(srcEntry.amount).toString())
            }
          } else {
            const srcEntry = initialData.entries.find(e => initialData.type === 'Expense' ? e.amount < 0 : e.amount > 0)
            const dstEntry = initialData.entries.find(e => initialData.type === 'Expense' ? e.amount > 0 : e.amount < 0)
            
            if (srcEntry && dstEntry) {
              setSourceAccountId(srcEntry.accountId)
              setTotalAmount(Math.abs(srcEntry.amount).toString())
              
              // We need categoryId, we can try to guess it from accounts if possible
              const account = accounts.find(a => a.id === dstEntry.accountId)
              setSplits([{
                id: generateId(),
                categoryId: account?.accountGroupId || '',
                subCategoryId: dstEntry.accountId,
                amount: ''
              }])
            }
          }
        }
      } else {
        resetForm()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData])

  // Combine DB Vendors with presets - memoized for performance
  const vendorOptions = useMemo(() => Array.from(
    new Set([...dbVendors.map((v) => v.name), ...PRESET_VENDORS])
  ), [dbVendors])

  // Payment Source Accounts (Asset / Bank / Cash / CreditCard / Investment)
  const paymentGroupIds = useMemo(() => new Set(
    accountGroups
      .filter((g) => g.accountType !== 'Expense' && g.accountType !== 'Income')
      .map((g) => g.id)
  ), [accountGroups])

  const paymentAccounts = useMemo(() => accounts.filter(
    (a) => !a.accountGroupId || paymentGroupIds.has(a.accountGroupId)
  ), [accounts, paymentGroupIds])

  // Category Account Groups (Strictly Expense or Income)
  const categoryGroups = useMemo(() => accountGroups.filter((g) => {
    if (type === 'Expense') return g.accountType === 'Expense'
    if (type === 'Income') return g.accountType === 'Income'
    return false
  }), [accountGroups, type])


  const updateSplit = useCallback((id: string, updates: Partial<SplitLine>) => {
    setSplits(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates }
        if (updates.categoryId) updated.subCategoryId = ''
        return updated
      }
      return s
    }))
  }, [])

  const addJournalLine = useCallback(() => {
    setJournalLines(prev => [...prev, { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Debit' }])
  }, [])

  const removeJournalLine = useCallback((id: string) => {
    setJournalLines(prev => prev.filter(l => l.id !== id))
  }, [])

  const updateJournalLine = useCallback((id: string, updates: Partial<JournalLine>) => {
    setJournalLines(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)))
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'Advanced') {
      if (!date) return

      let debitSum = 0
      let creditSum = 0
      const entries: LedgerEntry[] = []

      for (const line of journalLines) {
        if (!line.subCategoryId) continue
        const amt = parseFloat(line.amount || '0')
        if (amt === 0) continue

        if (line.type === 'Debit') debitSum += amt
        else creditSum += amt

        entries.push({
          accountId: line.subCategoryId,
          amount: line.type === 'Debit' ? amt : -amt
        })
      }

      if (Math.abs(debitSum - creditSum) > 0.01) {
        alert(`Debits (₱${debitSum.toFixed(2)}) must equal Credits (₱${creditSum.toFixed(2)}).`)
        return
      }

      if (entries.length < 2) {
        alert("At least two ledger entries are required.")
        return
      }

      const transaction: Transaction = {
        ...(initialData ? { id: initialData.id } : {}),
        type: 'Journal',
        entries,
        vendor: null,
        note,
        date: new Date(date).toISOString(),
      }

      const mutation = initialData ? updateTxMutation : createTxMutation
      mutation.mutate(transaction, {
        onSuccess: () => {
          if (submitTypeRef.current === 'more') {
            setTotalAmount('')
            setSplits([{ id: generateId(), categoryId: '', subCategoryId: '', amount: '' }])
            setJournalLines([
              { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Debit' },
              { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Credit' }
            ])
            setVendor('')
            setNote('')
          } else {
            onClose()
            if (!initialData) resetForm()
          }
        },
      })
      return
    }

    // Simple Mode handling
    if (!totalAmount || !sourceAccountId || !date) return

    const finalVendor = vendor

    if (finalVendor && !dbVendors.some((v) => v.name.toLowerCase() === finalVendor.toLowerCase())) {
      createVendorMutation.mutate(finalVendor)
    }

    const entries: LedgerEntry[] = []
    const parsedTotal = parseFloat(totalAmount)

    if (type === 'Transfer') {
      if (!toAccountId) return
      entries.push({ accountId: sourceAccountId, amount: -parsedTotal })
      entries.push({ accountId: toAccountId, amount: parsedTotal })
    } else {
      entries.push({ 
        accountId: sourceAccountId, 
        amount: type === 'Expense' ? -parsedTotal : parsedTotal 
      })

      const categorySplit = splits[0]
      if (!categorySplit?.subCategoryId) {
        alert("Please select a category.")
        return
      }

      entries.push({
        accountId: categorySplit.subCategoryId,
        amount: type === 'Expense' ? parsedTotal : -parsedTotal
      })
    }

    let finalScheduleId: string | undefined = undefined;

    if (isRecurring && !initialData) {
      finalScheduleId = uuidv7()
      let nextDate = new Date(date)
      if (frequency === 'Daily') nextDate.setDate(nextDate.getDate() + 1)
      else if (frequency === 'Weekly') nextDate.setDate(nextDate.getDate() + 7)
      else if (frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (frequency === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)

      createRecurringTxMutation.mutate({
        id: finalScheduleId,
        frequency,
        interval: 1,
        startDate: new Date(date).toISOString(),
        nextOccurrenceDate: nextDate.toISOString(),
        maxOccurrences: maxOccurrences ? parseInt(maxOccurrences) : undefined,
        templateType: type,
        templateNote: note,
        templateVendor: type === 'Transfer' ? undefined : finalVendor,
        templateEntries: entries.map(e => ({ accountId: e.accountId, amount: e.amount }))
      })
      // Do NOT return here. We want execution to continue and create the immediate transaction!
    }

    const transaction: Transaction = {
      ...(initialData ? { id: initialData.id } : {}),
      type,
      scheduleId: finalScheduleId,
      entries,
      vendor: type === 'Transfer' ? null : finalVendor,
      note,
      date: new Date(date).toISOString(),
    }

    const mutation = initialData ? updateTxMutation : createTxMutation

    mutation.mutate(transaction, {
      onSuccess: () => {
        if (submitTypeRef.current === 'more') {
          setTotalAmount('')
          setSplits([{ id: generateId(), categoryId: '', subCategoryId: '', amount: '' }])
          setJournalLines([
            { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Debit' },
            { id: generateId(), categoryId: '', subCategoryId: '', amount: '', type: 'Credit' }
          ])
          setVendor('')
          setNote('')
        } else {
          onClose()
          if (!initialData) resetForm()
        }
      },
    })
  }, [mode, date, journalLines, totalAmount, sourceAccountId, type, toAccountId, splits, vendor, dbVendors, note, initialData, createTxMutation, updateTxMutation, createVendorMutation, resetForm, onClose, isRecurring, frequency, maxOccurrences, createRecurringTxMutation])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50 transition-opacity duration-300"
      />
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 w-full md:max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-2xl z-55 shadow-2xl p-4 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800 animate-slide-up pb-safe max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Log Transaction</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle (Simple / Advanced) */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('Simple')}
            className={`flex-1 py-1.5 rounded-lg font-semibold text-xs uppercase tracking-wide transition-all cursor-pointer ${
              mode === 'Simple'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode('Advanced')}
            className={`flex-1 py-1.5 rounded-lg font-semibold text-xs uppercase tracking-wide transition-all cursor-pointer ${
              mode === 'Advanced'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Advanced
          </button>
        </div>

        {mode === 'Simple' && (
          <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['Expense', 'Income', 'Transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t)
                  setSplits([{ id: generateId(), categoryId: '', subCategoryId: '', amount: '' }])
                }}
                className={`py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  type === t
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'Simple' ? (
            <>
              {/* Total Amount */}
              <div className="flex flex-col gap-1">
                <CalculatorInput
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={setTotalAmount}
                  required
                  iconSize={8}
                  className="w-full text-3xl font-bold text-center py-2 border-b border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Source Account (Payment Account) */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{type === 'Income' ? 'Deposit To' : 'Pay From'}</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  required
                  className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Account...</option>
                  {Array.from(new Set(paymentAccounts.map(a => a.accountGroupId))).map(groupId => {
                    const group = accountGroups.find(g => g.id === groupId)
                    const groupAccounts = paymentAccounts.filter(a => a.accountGroupId === groupId)
                    if (!group || groupAccounts.length === 0) return null
                    return (
                      <optgroup key={group.id} label={group.name}>
                        {groupAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>

              {/* Destination Account (Only for Transfer) */}
              {type === 'Transfer' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transfer To</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    required
                    className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select Destination Account...</option>
                    {Array.from(new Set(paymentAccounts.filter(a => a.id !== sourceAccountId).map(a => a.accountGroupId))).map(groupId => {
                      const group = accountGroups.find(g => g.id === groupId)
                      const groupAccounts = paymentAccounts.filter(a => a.accountGroupId === groupId && a.id !== sourceAccountId)
                      if (!group || groupAccounts.length === 0) return null
                      return (
                        <optgroup key={group.id} label={group.name}>
                          {groupAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* Splits (Category & SubCategory) */}
              {type !== 'Transfer' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center mt-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                  </div>
                  
                  {splits.map((split) => {
                    const subCategoryOptions = accounts.filter(a => a.accountGroupId === split.categoryId)
                    return (
                      <div key={split.id} className="flex flex-col gap-2 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex gap-2">
                          <Combobox
                            options={categoryGroups.map(g => ({ value: g.id, label: g.name }))}
                            value={split.categoryId}
                            onChange={(val) => updateSplit(split.id, { categoryId: val })}
                            onCreate={(val) => {
                              createAccountGroupMutation.mutate({ name: val, accountType: type }, {
                                onSuccess: (data) => {
                                  if (data && data.id) {
                                    updateSplit(split.id, { categoryId: data.id })
                                  }
                                }
                              })
                            }}
                            placeholder="Select Category..."
                            className="flex-1"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Combobox
                            options={subCategoryOptions.map(a => ({ value: a.id!, label: a.name }))}
                            value={split.subCategoryId}
                            onChange={(val) => updateSplit(split.id, { subCategoryId: val })}
                            onCreate={(val) => {
                              if (!split.categoryId) {
                                alert('Please select a Category first.')
                                return
                              }
                              createAccountMutation.mutate({
                                name: val,
                                accountGroupId: split.categoryId,
                                accountType: type,
                                startingBalance: 0
                              }, {
                                onSuccess: (data) => {
                                  if (data && data.id) {
                                    updateSplit(split.id, { subCategoryId: data.id })
                                  }
                                }
                              })
                            }}
                            placeholder="Select Sub-Category..."
                            className="flex-1"
                            disabled={!split.categoryId}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Vendor Dropdown (Only for Expense) */}
              {type === 'Expense' && (
                <div className="flex flex-col gap-1 mt-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</label>
                  <Combobox
                    options={vendorOptions.filter(v => v !== 'Other / Custom').map(v => ({ value: v, label: v }))}
                    value={vendor}
                    onChange={(val) => setVendor(val)}
                    onCreate={(val) => {
                      createVendorMutation.mutate(val, {
                        onSuccess: () => {
                          setVendor(val)
                        }
                      })
                    }}
                    placeholder="Select Vendor (optional)..."
                  />
                </div>
              )}
            </>
          ) : (
            /* Advanced Mode: Journal Entry */
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center mt-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Journal Lines</label>
              </div>
              
              {journalLines.map((line) => (
                <div key={line.id} className="flex flex-col gap-2 p-2 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex gap-2">
                    <Combobox
                      options={accountGroups.map(g => ({ value: g.id, label: g.name }))}
                      value={line.categoryId}
                      onChange={(val) => updateJournalLine(line.id, { categoryId: val })}
                      onCreate={(val) => {
                        createAccountGroupMutation.mutate({ name: val, accountType: 'Adjustment' }, {
                          onSuccess: (data) => {
                            if (data && data.id) {
                              updateJournalLine(line.id, { categoryId: data.id })
                            }
                          }
                        })
                      }}
                      placeholder="Category..."
                      className="flex-1 text-sm"
                    />
                    <Combobox
                      options={accounts.filter(a => a.accountGroupId === line.categoryId).map(a => ({ value: a.id!, label: a.name }))}
                      value={line.subCategoryId}
                      onChange={(val) => updateJournalLine(line.id, { subCategoryId: val })}
                      onCreate={(val) => {
                        if (!line.categoryId) {
                          alert('Please select a Category first.')
                          return
                        }
                        const group = accountGroups.find(g => g.id === line.categoryId)
                        createAccountMutation.mutate({
                          name: val,
                          accountGroupId: line.categoryId,
                          accountType: group?.accountType as any || 'Adjustment',
                          startingBalance: 0
                        }, {
                          onSuccess: (data) => {
                            if (data && data.id) {
                              updateJournalLine(line.id, { subCategoryId: data.id })
                            }
                          }
                        })
                      }}
                      placeholder="Account..."
                      className="flex-1 text-sm"
                      disabled={!line.categoryId}
                    />
                  </div>
                  
                  <div className="flex gap-2 items-center w-full">
                    <div className="flex flex-col flex-1 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden focus-within:border-blue-600 bg-white dark:bg-slate-950">
                      <div className="flex text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => updateJournalLine(line.id, { type: 'Debit' })}
                          className={`flex-1 py-1 text-center transition-colors ${line.type === 'Debit' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                          Dr
                        </button>
                        <button
                          type="button"
                          onClick={() => updateJournalLine(line.id, { type: 'Credit' })}
                          className={`flex-1 py-1 text-center transition-colors ${line.type === 'Credit' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                          Cr
                        </button>
                      </div>
                      <CalculatorInput
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(val) => {
                          const num = parseFloat(val)
                          if (num < 0) {
                            updateJournalLine(line.id, { 
                              amount: Math.abs(num).toString(), 
                              type: line.type === 'Debit' ? 'Credit' : 'Debit' 
                            })
                          } else {
                            updateJournalLine(line.id, { amount: val })
                          }
                        }}
                        required
                        className="w-full min-h-[30px] px-2 pr-8 text-right bg-transparent text-sm focus:outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    
                    {journalLines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeJournalLine(line.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addJournalLine}
                className="mt-1 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer border border-dashed border-slate-300 dark:border-slate-600"
              >
                <Plus className="w-4 h-4" /> Add Line
              </button>
              
              <div className="flex justify-between items-center text-sm font-medium mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <span className="text-slate-500">Totals:</span>
                <div className="flex gap-4">
                  <span className="text-blue-600 dark:text-blue-400">
                    Dr: ₱{journalLines.filter(l => l.type === 'Debit').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">
                    Cr: ₱{journalLines.filter(l => l.type === 'Credit').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Shared Date and Note for both modes */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note</label>
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full"
              />
            </div>
          </div>

          {!initialData && (
            <div className="mt-4 p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Make this recurring</span>
                  <span className="text-xs text-slate-500">Auto-generate this transaction</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </div>
              </label>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequency</label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as any)}
                      className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Max Times (Optional)</label>
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={maxOccurrences}
                      onChange={e => setMaxOccurrences(e.target.value)}
                      className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {initialData ? (
            <button
              type="submit"
              onClick={() => { submitTypeRef.current = 'close' }}
              className="w-full min-h-[48px] mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer text-lg shadow-sm"
            >
              Save Changes
            </button>
          ) : (
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                onClick={() => { submitTypeRef.current = 'close' }}
                className="flex-[2] min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-sm text-sm"
              >
                Save & Close
              </button>
              <button
                type="submit"
                onClick={() => { submitTypeRef.current = 'more' }}
                className="flex-[1.5] min-h-[48px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-sm text-sm"
              >
                Save & Add Another
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  )
}
