import { useState } from 'react'
import { useGetHistoricalHooks, useImportHistoricalHook, useIgnoreHistoricalHook, useConfirmIngestion } from '@/hooks/useIngestions'
import { Sparkles, Calendar, Bell, ShieldCheck, EyeOff } from 'lucide-react'
import dayjs from 'dayjs'

export default function HistoricalHooksList() {
  const { data: hooks = [], isLoading, error } = useGetHistoricalHooks()
  const importMutation = useImportHistoricalHook()
  const ignoreMutation = useIgnoreHistoricalHook()
  const [processingIds, setProcessingIds] = useState<string[]>([])

  const confirmMutation = useConfirmIngestion()

  const handleImport = (hookId: string) => {
    setProcessingIds(prev => [...prev, hookId])
    importMutation.mutate(hookId, {
      onSuccess: (data) => {
        if (data.status === 'AutoConfirmed' || data.status === 'Confirmed') {
          setProcessingIds(prev => prev.filter(id => id !== hookId))
          return
        }

        if (data.ai_parsed && data.ai_parsed.transaction_type && data.ai_parsed.debit_account_id && data.ai_parsed.credit_account_id) {
          confirmMutation.mutate({
            id: data.id,
            userConfirmed: {
              vendor: data.ai_parsed.vendor || null,
              amount: data.ai_parsed.amount || 0,
              transaction_type: data.ai_parsed.transaction_type,
              debit_account_id: data.ai_parsed.debit_account_id,
              credit_account_id: data.ai_parsed.credit_account_id,
              notes: data.ai_parsed.summary || data.ai_parsed.notes || '',
              user_why: null
            }
          }, {
            onSettled: () => setProcessingIds(prev => prev.filter(id => id !== hookId)),
            onError: () => {
              // Silently fail the auto-confirm, it stays in review queue
            }
          })
        } else {
          setProcessingIds(prev => prev.filter(id => id !== hookId))
        }
      },
      onError: (err) => {
        alert('Failed to import historical hook: ' + (err as any)?.message)
        setProcessingIds(prev => prev.filter(id => id !== hookId))
      }
    })
  }

  const handleIgnore = (hookId: string) => {
    if (!confirm('Are you sure you want to ignore this historical log?')) return
    setProcessingIds(prev => [...prev, hookId])
    ignoreMutation.mutate(hookId, {
      onError: (err) => {
        alert('Failed to ignore historical hook: ' + (err as any)?.message)
      },
      onSettled: () => {
        setProcessingIds(prev => prev.filter(id => id !== hookId))
      }
    })
  }

  const getAppName = (pkg?: any) => {
    let resolvedPkg = pkg
    if (Array.isArray(pkg)) {
      resolvedPkg = pkg.length > 0 ? pkg[0] : ''
    }
    if (typeof resolvedPkg !== 'string') return 'SMS / Notification'
    const pkgLower = resolvedPkg.toLowerCase()
    if (pkgLower.includes('gcash')) return 'GCash'
    if (pkgLower.includes('bpi') || pkgLower.includes('indivara')) return 'BPI'
    if (pkgLower.includes('maya')) return 'Maya'
    return resolvedPkg || 'App'
  }

  if (isLoading) {
    return (
      <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-sm text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
        <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
        Fetching historical logs from old database...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 border border-red-200 dark:border-red-800/30 rounded-2xl text-center text-sm text-red-500 bg-red-50/50 dark:bg-red-950/20">
        Failed to load historical hooks. Please make sure the old database is connected.
      </div>
    )
  }

  if (hooks.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-sm text-slate-500 bg-slate-50/30 dark:bg-slate-900/10">
        <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
        No historical logs to import! All logs have been reviewed or imported.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Bell className="w-4 h-4 text-blue-500" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Unprocessed Historical Logs ({hooks.length})
        </h2>
      </div>

      <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
        {hooks.map((hook) => {
          const appName = getAppName(hook.ExtractedData?.app || hook.JsonData?.notif_pkg || hook.JsonData?.sms_sender)
          const amountVal = hook.ExtractedData?.amount
          const parsedAmount = amountVal !== undefined && amountVal !== null
            ? (typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal).replace(/,/g, '')))
            : null

          return (
            <div
              key={hook.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                      {appName}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dayjs(hook.Date).format('MMM DD, YYYY • h:mm A')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                    {hook.RawMsg}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between h-full gap-2">
                  {parsedAmount !== null && (
                    <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                      ₱{parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleIgnore(hook.id)}
                      disabled={processingIds.includes(hook.id)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-350 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Ignore
                    </button>
                    <button
                      onClick={() => handleImport(hook.id)}
                      disabled={processingIds.includes(hook.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-xs rounded-xl flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                    >
                      {importMutation.isPending && processingIds.includes(hook.id) ? (
                        <>
                          <Sparkles className="w-3 h-3 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Import
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
