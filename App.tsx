import React, { useState, useEffect } from 'react';
import { ViewState, Toast, SystemUser, SystemRole } from './types';
import { BooksView } from './views/BooksView';
import { CirculationView } from './views/CirculationView';
import { SettingsView } from './views/SettingsView';
import { LogsView } from './views/LogsView';
import { UsersView } from './views/UsersView';
import { LoginView } from './views/LoginView';
import { db } from './services/storage';
import { 
  LayoutDashboard, 
  Book, 
  ArrowRightLeft, 
  Users, 
  Library, 
  Bell,
  Settings,
  ScrollText,
  Lock,
  LogOut,
  User as UserIcon,
  Key,
  Loader2
} from 'lucide-react';
import { Card, Button, Input, Modal } from './components/Shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SidebarItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void 
}> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1
      ${active 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  
  // Change Password State
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Dashboard Data
  const [stats, setStats] = useState({ totalBooks: 0, totalCopies: 0, activeLoans: 0, overdue: 0 });
  const [categoryData, setCategoryData] = useState<{name: string, value: number}[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleLogin = (user: SystemUser) => {
    setCurrentUser(user);
    addToast(`Welcome back, ${user.name}`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('DASHBOARD');
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      addToast("Please fill all fields", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }
    if (currentUser) {
      try {
        await db.changeUserPassword(currentUser.id, newPassword);
        addToast("Password changed successfully", "success");
        setIsChangePassOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } catch (e) {
        addToast("Failed to change password", "error");
      }
    }
  };

  // --- Dashboard Logic ---
  useEffect(() => {
    if (currentUser && view === 'DASHBOARD') {
      loadDashboardData();
    }
  }, [currentUser, view]);

  const loadDashboardData = async () => {
    setLoadingDashboard(true);
    try {
        const [books, copies, transactions] = await Promise.all([
            db.getBooks(),
            db.getCopies(),
            db.getTransactions()
        ]);

        const activeTxs = transactions.filter(t => t.status === 'ACTIVE');
        const overdueTxs = activeTxs.filter(t => new Date(t.dueDate) < new Date());

        setStats({
            totalBooks: books.length,
            totalCopies: copies.length,
            activeLoans: activeTxs.length,
            overdue: overdueTxs.length
        });

        // Calculate Categories
        const counts: Record<string, number> = {};
        books.forEach(book => {
            const cat = book.categories[0] || 'Uncategorized';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        setCategoryData(Object.entries(counts).map(([name, value]) => ({ name, value })));

    } catch (e) {
        console.error(e);
        addToast("Failed to load dashboard data", "error");
    } finally {
        setLoadingDashboard(false);
    }
  };

  // --- Permissions Logic ---
  const isAdmin = currentUser?.role === SystemRole.ADMIN;
  
  useEffect(() => {
    if (currentUser) {
        if (view === 'SETTINGS' && !isAdmin) {
            setView('DASHBOARD');
            addToast("Access Restricted: Admin only", "error");
        }
        if (view === 'USERS' && !isAdmin) {
            setView('DASHBOARD');
            addToast("Access Restricted: Admin only", "error");
        }
    }
  }, [currentUser, view]);

  if (!currentUser) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto shadow-lg rounded-lg px-4 py-3 text-sm font-medium animate-in slide-in-from-right fade-in duration-300
                ${t.type === 'success' ? 'bg-green-600 text-white' : 
                t.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                {t.message}
            </div>
            ))}
        </div>
        <LoginView onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto shadow-lg rounded-lg px-4 py-3 text-sm font-medium animate-in slide-in-from-right fade-in duration-300
            ${t.type === 'success' ? 'bg-green-600 text-white' : 
              t.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-2 px-2 mb-8 mt-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Library size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Instuto</h1>
        </div>

        <nav className="flex-1">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={view === 'DASHBOARD'} 
            onClick={() => setView('DASHBOARD')} 
          />
          <SidebarItem 
            icon={<Book size={20} />} 
            label="Catalog" 
            active={view === 'BOOKS'} 
            onClick={() => setView('BOOKS')} 
          />
          <SidebarItem 
            icon={<ArrowRightLeft size={20} />} 
            label="Circulation" 
            active={view === 'CIRCULATION'} 
            onClick={() => setView('CIRCULATION')} 
          />
          <SidebarItem 
            icon={<ScrollText size={20} />} 
            label="Logs" 
            active={view === 'LOGS'} 
            onClick={() => setView('LOGS')} 
          />
          
          {isAdmin && (
            <>
              <div className="my-2 border-t border-slate-100"></div>
              <SidebarItem 
                icon={<Users size={20} />} 
                label="Users" 
                active={view === 'USERS'} 
                onClick={() => setView('USERS')} 
              />
              <SidebarItem 
                icon={<Settings size={20} />} 
                label="Settings" 
                active={view === 'SETTINGS'} 
                onClick={() => setView('SETTINGS')} 
              />
            </>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100">
           {/* User Profile Section */}
           <div className="px-2">
             <div className="flex items-center gap-3 mb-3">
               <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                 {currentUser?.name.split(' ').map(n => n[0]).join('').substring(0,2) || 'U'}
               </div>
               <div className="min-w-0">
                 <p className="text-sm font-semibold text-slate-800 truncate">{currentUser.name}</p>
                 <p className="text-xs text-slate-500 truncate capitalize">{currentUser.role.toLowerCase()}</p>
               </div>
             </div>
             <div className="flex gap-1">
                <button 
                    onClick={() => setIsChangePassOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Change Password"
                >
                    <Key size={14} /> Password
                </button>
                <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Logout"
                >
                    <LogOut size={16} />
                </button>
             </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-700">
              {view === 'DASHBOARD' ? 'Library Overview' : 
              view === 'BOOKS' ? 'Book Management' : 
              view === 'CIRCULATION' ? 'Circulation Desk' : 
              view === 'LOGS' ? 'System Logs' : 
              view === 'SETTINGS' ? 'System Configuration' : 'User Management'}
            </h2>
            {(view === 'SETTINGS' || view === 'USERS') && (
               <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                 <Lock size={10} /> Admin Area
               </span>
            )}
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 relative">
            <Bell size={20} />
            {stats.overdue > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
          </button>
        </header>

        <main className="flex-1 overflow-hidden p-8">
          {view === 'DASHBOARD' && (
            loadingDashboard ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : (
            <div className="h-full overflow-y-auto">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6">
                  <p className="text-sm text-slate-500 font-medium mb-1">Total Books</p>
                  <h3 className="text-3xl font-bold text-slate-800">{stats.totalBooks}</h3>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-slate-500 font-medium mb-1">Active Loans</p>
                  <h3 className="text-3xl font-bold text-blue-600">{stats.activeLoans}</h3>
                  <div className="mt-2 text-xs text-slate-400">Current circulation</div>
                </Card>
                <Card className="p-6 border-l-4 border-l-red-500">
                  <p className="text-sm text-slate-500 font-medium mb-1">Overdue</p>
                  <h3 className="text-3xl font-bold text-red-600">{stats.overdue}</h3>
                  <div className="mt-2 text-xs text-red-400">Needs attention</div>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-slate-500 font-medium mb-1">Total Copies</p>
                  <h3 className="text-3xl font-bold text-slate-800">{stats.totalCopies}</h3>
                </Card>
              </div>

              {/* Charts & Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6 min-h-[400px]">
                  <h3 className="font-bold text-slate-800 mb-6">Collection by Category</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ background: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          cursor={{fill: '#f1f5f9'}}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'][index % 4]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setView('BOOKS')}
                      className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 transition-colors flex items-center gap-3"
                    >
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Book size={18}/></div>
                      <div>
                        <p className="font-medium text-slate-900">Add New Book</p>
                        <p className="text-xs text-slate-500">Catalog entry</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => setView('CIRCULATION')}
                      className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 transition-colors flex items-center gap-3"
                    >
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg"><ArrowRightLeft size={18}/></div>
                      <div>
                        <p className="font-medium text-slate-900">Issue Book</p>
                        <p className="text-xs text-slate-500">Start transaction</p>
                      </div>
                    </button>
                    
                    {isAdmin ? (
                        <button 
                          onClick={() => setView('SETTINGS')}
                          className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Settings size={18}/></div>
                          <div>
                            <p className="font-medium text-slate-900">Settings</p>
                            <p className="text-xs text-slate-500">Manage dropdowns</p>
                          </div>
                        </button>
                    ) : (
                        <div className="w-full text-left p-3 rounded-lg border border-dashed bg-slate-50 flex items-center gap-3 opacity-60 cursor-not-allowed" title="Admin only">
                          <div className="p-2 bg-slate-200 text-slate-500 rounded-lg"><Lock size={18}/></div>
                          <div>
                            <p className="font-medium text-slate-600">Settings</p>
                            <p className="text-xs text-slate-400">Restricted Access</p>
                          </div>
                        </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          ))}

          {view === 'BOOKS' && <BooksView onNotify={addToast} currentUser={currentUser} />}
          {view === 'CIRCULATION' && <CirculationView onNotify={addToast} currentUser={currentUser} />}
          {view === 'LOGS' && <LogsView onNotify={addToast} />}
          
          {view === 'SETTINGS' && (
             isAdmin ? <SettingsView onNotify={addToast} /> : <div className="p-10 text-center text-slate-500">Access Denied</div>
          )}
          
          {view === 'USERS' && currentUser && (
             isAdmin ? <UsersView onNotify={addToast} currentUser={currentUser} /> : <div className="p-10 text-center text-slate-500">Access Denied</div>
          )}
        </main>
      </div>

      <Modal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
        title="Change Password"
        footer={
            <>
                <Button variant="ghost" onClick={() => setIsChangePassOpen(false)}>Cancel</Button>
                <Button onClick={handleChangePassword}>Update Password</Button>
            </>
        }
      >
        <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 mb-2">
                Updating password for <strong>{currentUser.email}</strong>.
            </div>
            <Input 
                label="New Password" 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
            />
            <Input 
                label="Confirm Password" 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
            />
        </div>
      </Modal>
    </div>
  );
};

export default App;