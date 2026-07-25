import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_BASE_URL = 'http://localhost:7198/api' // Matches backend Functions default port

export type Frequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'

export interface RecurringTransactionOccurrence {
  date: string
  occurrenceNo: number
  status: string
  transactionId?: string
}

export interface RecurringLedgerEntry {
  accountId: string
  amount: number
}

export interface RecurringTransaction {
  id?: string
  userId?: string
  frequency: Frequency
  interval: number
  startDate: string
  endDate?: string
  maxOccurrences?: number
  nextOccurrenceDate?: string
  templateType: 'Income' | 'Expense' | 'Transfer' | 'Journal'
  templateNote: string
  templateVendor?: string
  templateEntries: RecurringLedgerEntry[]
  occurrences?: RecurringTransactionOccurrence[]
}

export const useGetRecurringTransactions = () => {
  return useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: async (): Promise<RecurringTransaction[]> => {
      const res = await fetch(`${API_BASE_URL}/recurring-transactions`)
      if (!res.ok) throw new Error('Failed to fetch recurring transactions')
      return res.json()
    }
  })
}

export const useCreateRecurringTransaction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tx: RecurringTransaction) => {
      const res = await fetch(`${API_BASE_URL}/recurring-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      })
      if (!res.ok) throw new Error('Failed to create recurring transaction')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] })
    }
  })
}

export const useUpdateRecurringTransaction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tx: RecurringTransaction) => {
      const res = await fetch(`${API_BASE_URL}/recurring-transactions/${tx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      })
      if (!res.ok) throw new Error('Failed to update recurring transaction')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] })
    }
  })
}

export const useDeleteRecurringTransaction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/recurring-transactions/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete recurring transaction')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] })
    }
  })
}
