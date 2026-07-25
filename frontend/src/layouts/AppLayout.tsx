import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, ArrowLeftRight, Wallet, Settings, Plus } from 'lucide-react'
import AddTransactionModal from '@/components/AddTransactionModal'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Accounts', icon: Wallet },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto relative bg-slate-50 dark:bg-slate-950">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* FAB — Add Transaction */}
      <button
        id="fab-add-transaction"
        aria-label="Add transaction"
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-[90px] right-6 z-50 w-[64px] h-[64px] rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-700 active:scale-95 transition-all duration-200"
      >
        <Plus className="w-[32px] h-[32px]" strokeWidth={2} />
      </button>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Bottom Navigation */}
      <nav
        id="bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 max-w-5xl mx-auto"
      >
        <div className="flex items-stretch">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = currentPath === path
            return (
              <button
                key={path}
                id={`nav-${label.toLowerCase()}`}
                onClick={() => navigate({ to: path })}
                aria-label={label}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px] cursor-pointer transition-colors duration-200
                  ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                <Icon className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
