import React, { useState } from 'react'
import { Plus, Trash2, Tag, Store } from 'lucide-react'
import {
  useGetAccountGroups,
  useCreateAccountGroup,
  useDeleteAccountGroup,
  useGetAccounts,
  useCreateAccount,
  useDeleteAccount,
} from '@/hooks/useAccounts'
import {
  useGetVendors,
  useCreateVendor,
  useDeleteVendor,
} from '@/hooks/useVendors'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'categories' | 'vendors'>('categories')

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage your categories and vendors</p>
      </div>

      <div className="flex px-4 pt-4 gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'categories'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> Categories
          </div>
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'vendors'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4" /> Vendors
          </div>
        </button>
      </div>

      <div className="p-4 overflow-y-auto">
        {activeTab === 'categories' && <CategoriesSettings />}
        {activeTab === 'vendors' && <VendorsSettings />}
      </div>
    </div>
  )
}

function CategoriesSettings() {
  const { data: groups = [] } = useGetAccountGroups()
  const { data: accounts = [] } = useGetAccounts()
  
  const createGroup = useCreateAccountGroup()
  const deleteGroup = useDeleteAccountGroup()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupType, setNewGroupType] = useState<'Expense' | 'Income'>('Expense')
  const [newAccountNames, setNewAccountNames] = useState<Record<string, string>>({})

  const categoryGroups = groups.filter((g) => g.accountType === 'Expense' || g.accountType === 'Income')

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    createGroup.mutate(
      { name: newGroupName.trim(), accountType: newGroupType },
      { onSuccess: () => setNewGroupName('') }
    )
  }

  const handleCreateSubCategory = (e: React.FormEvent, groupId: string, type: string) => {
    e.preventDefault()
    const name = newAccountNames[groupId]?.trim()
    if (!name) return
    createAccount.mutate(
      { name, accountGroupId: groupId, accountType: type as any, startingBalance: 0 },
      { onSuccess: () => setNewAccountNames((prev) => ({ ...prev, [groupId]: '' })) }
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-8">
      <section className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Category</h2>
        <form onSubmit={handleCreateGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="Category Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1 min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <select
            value={newGroupType}
            onChange={(e) => setNewGroupType(e.target.value as any)}
            className="min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </section>

      <div className="flex flex-col gap-4">
        {categoryGroups.map((group) => {
          const groupAccounts = accounts.filter((a) => a.accountGroupId === group.id)
          const isExpense = group.accountType === 'Expense'

          return (
            <div key={group.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 px-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    isExpense ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    {group.accountType}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{group.name}</span>
                </div>
                <button
                  onClick={() => deleteGroup.mutate(group.id)}
                  className="text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 flex flex-col">
                {groupAccounts.map((acc) => (
                  <div key={acc.id} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{acc.name}</span>
                    <button
                      onClick={() => deleteAccount.mutate(acc.id!)}
                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <form onSubmit={(e) => handleCreateSubCategory(e, group.id, group.accountType!)} className="flex items-center mt-2 px-2">
                  <input
                    type="text"
                    placeholder="Add sub-category..."
                    value={newAccountNames[group.id] || ''}
                    onChange={(e) => setNewAccountNames((prev) => ({ ...prev, [group.id]: e.target.value }))}
                    className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 min-h-[32px]"
                  />
                  <button type="submit" className="text-blue-600 hover:text-blue-700 p-1" disabled={!newAccountNames[group.id]?.trim()}>
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VendorsSettings() {
  const { data: vendors = [] } = useGetVendors()
  const createVendor = useCreateVendor()
  const deleteVendor = useDeleteVendor()

  const [newVendorName, setNewVendorName] = useState('')

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVendorName.trim()) return
    createVendor.mutate(newVendorName.trim(), { onSuccess: () => setNewVendorName('') })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-8">
      <section className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Vendor</h2>
        <form onSubmit={handleCreateVendor} className="flex gap-2">
          <input
            type="text"
            placeholder="Vendor Name"
            value={newVendorName}
            onChange={(e) => setNewVendorName(e.target.value)}
            className="flex-1 min-h-[44px] px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </section>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
              <span className="font-medium text-slate-900 dark:text-slate-50">{vendor.name}</span>
              <button
                onClick={() => deleteVendor.mutate(vendor.id!)}
                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {vendors.length === 0 && (
            <div className="p-8 text-center text-slate-500">No vendors found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
