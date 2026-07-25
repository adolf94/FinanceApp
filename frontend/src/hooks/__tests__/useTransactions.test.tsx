// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetTransactions, useUpdateTransaction, useDeleteTransaction, useCreateTransaction, Transaction } from '../useTransactions'
import apiClient from '@/lib/apiClient'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/apiClient')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useTransactions hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches monthly transactions successfully', async () => {
    const mockData: Transaction[] = [{ id: '1', type: 'Expense', date: '2023-10-10', entries: [] }]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(() => useGetTransactions('2023-10-01', '2023-10-31'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/transactions', { params: { startDate: '2023-10-01', endDate: '2023-10-31' } })
  })

  it('creates transaction successfully', async () => {
    const newTx: Transaction = { type: 'Income', date: '2023-10-11', entries: [] }
    const createdTx = { ...newTx, id: '2' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: createdTx })

    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() })
    
    result.current.mutate(newTx)
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.post).toHaveBeenCalledWith('/transactions', newTx)
  })

  it('updates transaction successfully', async () => {
    const updatedTx: Transaction = { id: '1', type: 'Expense', date: '2023-10-10', entries: [] }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: updatedTx })

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper: createWrapper() })
    
    result.current.mutate(updatedTx)
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.put).toHaveBeenCalledWith(`/transactions/${updatedTx.id}`, updatedTx)
  })

  it('deletes transaction successfully', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() })
    
    result.current.mutate('1')
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.delete).toHaveBeenCalledWith('/transactions/1')
  })
})
