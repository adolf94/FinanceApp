import { useMemo } from 'react'
import { useGetAccounts } from './useAccounts'
import { useGetTransactions } from './useTransactions'
import dayjs from 'dayjs'

export function useAnalysis(selectedMonth: dayjs.Dayjs = dayjs()) {
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccounts()
  
  // Fetch transactions for the 6 months ending in the selected month
  const sixMonthsAgo = selectedMonth.subtract(5, 'month').startOf('month').format('YYYY-MM-DD')
  const endOfSelectedMonth = selectedMonth.endOf('month').format('YYYY-MM-DD')
  
  const { data: transactions = [], isLoading: isLoadingTransactions } = useGetTransactions(sixMonthsAgo, endOfSelectedMonth)

  const analysisData = useMemo(() => {
    let netWorth = 0
    
    const assetTypes = ['Cash', 'Bank', 'Investment', 'Asset']
    const liabilityTypes = ['CreditCard', 'Liability']
    
    accounts.forEach(acc => {
       if (assetTypes.includes(acc.accountType)) {
          netWorth += (acc.currentBalance || 0)
       } else if (liabilityTypes.includes(acc.accountType)) {
          // Liabilities generally have negative balances if credited, or positive if we treat them mathematically.
          // By standard double-entry accounting in this app, adding is correct.
          netWorth += (acc.currentBalance || 0)
       }
    })

    // Selected Month's Income & Expense
    const startOfSelectedMonth = selectedMonth.startOf('month')
    let currentMonthIncome = 0
    let currentMonthExpense = 0
    
    const thisMonthTransactions = transactions.filter(t => dayjs(t.date).isAfter(startOfSelectedMonth) || dayjs(t.date).isSame(startOfSelectedMonth))
    
    const categorySpending: Record<string, number> = {}
    
    thisMonthTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        const acc = accounts.find(a => a.id === entry.accountId)
        if (acc) {
           if (acc.accountType === 'Expense') {
              currentMonthExpense += entry.amount
              
              const categoryName = acc.name
              if (!categorySpending[categoryName]) {
                 categorySpending[categoryName] = 0
              }
              categorySpending[categoryName] += entry.amount
           } else if (acc.accountType === 'Income') {
              // Income is credited, so amount is negative
              currentMonthIncome += Math.abs(entry.amount)
           }
        }
      })
    })
    
    const spendingByCategoryChartData = Object.entries(categorySpending).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value)
    
    // Monthly Bar Chart Data (Last 6 Months ending in selectedMonth)
    const monthlyDataMap: Record<string, { income: number, expense: number }> = {}
    
    for (let i = 5; i >= 0; i--) {
      const monthStr = selectedMonth.subtract(i, 'month').format('MMM YYYY')
      monthlyDataMap[monthStr] = { income: 0, expense: 0 }
    }
    
    transactions.forEach(tx => {
      const monthStr = dayjs(tx.date).format('MMM YYYY')
      if (monthlyDataMap[monthStr]) {
         tx.entries.forEach(entry => {
            const acc = accounts.find(a => a.id === entry.accountId)
            if (acc) {
               if (acc.accountType === 'Expense') {
                  monthlyDataMap[monthStr].expense += entry.amount
               } else if (acc.accountType === 'Income') {
                  monthlyDataMap[monthStr].income += Math.abs(entry.amount)
               }
            }
         })
      }
    })
    
    const monthlyBarChartData = Object.entries(monthlyDataMap).map(([month, data]) => ({
      month,
      Income: data.income,
      Expense: data.expense
    }))

    return {
      netWorth,
      currentMonthIncome,
      currentMonthExpense,
      spendingByCategoryChartData,
      monthlyBarChartData,
      goalProgress: 65 // Hardcoded for now
    }
  }, [accounts, transactions])

  return {
    ...analysisData,
    isLoading: isLoadingAccounts || isLoadingTransactions
  }
}
