// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetRecurringTransactions } from '../useRecurringTransactions'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useRecurringTransactions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    
    // We need to mock the global fetch since useRecurringTransactions uses native fetch directly
    globalThis.fetch = vi.fn()
  })

  it('fetches recurring transactions successfully', async () => {
    const mockData = [
      { 
        id: '1', 
        frequency: 'Monthly',
        interval: 1,
        startDate: '2023-01-01',
        templateType: 'Expense',
        templateNote: 'Spotify',
        templateEntries: []
      }
    ]
    
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response)

    const { result } = renderHook(() => useGetRecurringTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:7198/api/recurring-transactions')
  })
  
  it('handles error when fetching fails', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false
    } as Response)

    const { result } = renderHook(() => useGetRecurringTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to fetch recurring transactions')
  })
})
