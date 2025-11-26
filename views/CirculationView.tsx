
import React, { useState, useEffect } from 'react';
import { Book, Copy, CopyStatus, Transaction, TransactionStatus, User, ReturnCondition, SystemSettings, SystemUser } from '../types';
import { db } from '../services/storage';
import { Card, Button, Input, Badge, Modal, Select } from '../components/Shared';
import { Plus, Search, Calendar, User as UserIcon, AlertCircle, CheckCircle, XCircle, AlertTriangle, Clock, RotateCw, X, Filter, Loader2 } from 'lucide-react';

interface CirculationViewProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  currentUser: SystemUser;
}

export const CirculationView: React.FC<CirculationViewProps> = ({ onNotify, currentUser }) => {
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [allCopies, setAllCopies] = useState<Copy[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [search, setSearch] = useState('');
  const [filterLenderType, setFilterLenderType] = useState('');
  const [filterLentStart, setFilterLentStart] = useState('');
  const [filterLentEnd, setFilterLentEnd] = useState('');
  const [filterReturnOption, setFilterReturnOption] = useState('');
  
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [lenderId, setLenderId] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [lenderType, setLenderType] = useState('');
  
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [matchingCopies, setMatchingCopies] = useState<{copy: Copy, book: Book}[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<{copy: Copy, book: Book} | null>(null);
  
  const [calculatedDueDate, setCalculatedDueDate] = useState<Date | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
        const [fetchedUsers, fetchedSettings, fetchedBooks, fetchedCopies, fetchedTransactions] = await Promise.all([
            db.getUsers(),
            db.getSettings(),
            db.getBooks(),
            db.getCopies(),
            db.getTransactions()
        ]);
        
        setUsers(fetchedUsers);
        setSettings(fetchedSettings);
        setBooks(fetchedBooks);
        setAllCopies(fetchedCopies);
        
        const active = fetchedTransactions
            .filter(t => t.status === TransactionStatus.ACTIVE)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setActiveTransactions(active);
    } catch (e) {
        onNotify("Failed to load circulation data", "error");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookSearchTerm.trim() || selectedCopy) {
        setMatchingCopies([]);
        return;
    }
    const term = bookSearchTerm.toLowerCase();
    const available = allCopies.filter(c => c.status === CopyStatus.AVAILABLE);
    
    const matches: {copy: Copy, book: Book}[] = [];
    
    for (const copy of available) {
        const book = books.find(b => b.id === copy.bookId);
        if (!book) continue;

        if (
            copy.id.toLowerCase().includes(term) ||
            book.title.toLowerCase().includes(term) ||
            book.isbn.includes(term)
        ) {
            matches.push({ copy, book });
        }
        if (matches.length >= 5) break; 
    }
    setMatchingCopies(matches);
  }, [bookSearchTerm, allCopies, books, selectedCopy]);

  const getUserRole = (userId: string) => {
    return users.find(u => u.id === userId)?.role || 'Unknown';
  };

  const getDaysOverdue = (dueDateStr: string) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    due.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };
  
  const getDurationForType = (type: string) => {
      if (!settings) return 14;
      const config = settings.lenderTypes.find(t => t.name === type);
      return config ? config.duration : 14;
  };

  const handleUserLookup = () => {
    if (!lenderId.trim()) return;
    const existingUser = users.find(u => u.id === lenderId.trim());
    if (existingUser) {
        setLenderName(existingUser.name);
        setLenderType(existingUser.role);
        updateCalculatedDueDate(existingUser.role);
    }
  };

  const updateCalculatedDueDate = (type: string) => {
      if (!type) {
          setCalculatedDueDate(null);
          return;
      }
      const days = getDurationForType(type);
      const due = new Date();
      due.setDate(due.getDate() + days);
      setCalculatedDueDate(due);
  };

  const handleLenderTypeChange = (val: string) => {
      setLenderType(val);
      updateCalculatedDueDate(val);
  };
  
  const selectCopy = (match: {copy: Copy, book: Book}) => {
    setSelectedCopy(match);
    setBookSearchTerm('');
    setMatchingCopies([]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        const exactMatch = allCopies.find(c => c.id === bookSearchTerm.trim() && c.status === CopyStatus.AVAILABLE);
        if (exactMatch) {
            const book = books.find(b => b.id === exactMatch.bookId);
            if (book) {
                selectCopy({ copy: exactMatch, book });
                return;
            }
        }
        if (matchingCopies.length === 1) {
            selectCopy(matchingCopies[0]);
        }
    }
  };

  const handleLend = async () => {
    if (!lenderId.trim() || !lenderName.trim() || !lenderType) {
      onNotify("Please fill in all lender details (ID, Name, Type)", 'error');
      return;
    }
    
    let target = selectedCopy;
    if (!target) {
      onNotify("Please select a valid available book (Barcode/Title/ISBN)", 'error');
      return;
    }

    const { copy, book } = target;

    try {
        let user = users.find(u => u.id === lenderId.trim());
        const isNewUser = !user;
        
        if (isNewUser) {
            user = {
                id: lenderId.trim(),
                name: lenderName.trim(),
                role: lenderType,
            };
            await db.saveUser(user);
        } else if (user) {
            if (user.name !== lenderName.trim() || user.role !== lenderType) {
                user.name = lenderName.trim();
                user.role = lenderType;
                await db.saveUser(user);
            }
        }

        const days = getDurationForType(lenderType);
        const dueDate = new Date(Date.now() + days * 86400000).toISOString();

        const newTx: Transaction = {
        id: crypto.randomUUID(),
        copyId: copy.id,
        bookId: copy.bookId,
        userId: user!.id,
        userName: user!.name,
        issueDate: new Date().toISOString(),
        dueDate: dueDate,
        status: TransactionStatus.ACTIVE,
        };

        await db.createTransaction(newTx);
        
        if (book) {
            await db.addLog({
                id: crypto.randomUUID(),
                bookId: book.id,
                bookTitle: book.title,
                action: 'BORROWED',
                description: `Copy #${copy.id} issued to ${user?.name} (${user?.role}). Due: ${new Date(newTx.dueDate).toLocaleDateString()}`,
                timestamp: new Date().toISOString(),
                userId: user?.id,
                userName: user?.name,
                staffId: currentUser.id,
                staffName: currentUser.name
            });
        }

        setBookSearchTerm('');
        setSelectedCopy(null);
        setLenderId('');
        setLenderName('');
        setLenderType('');
        setCalculatedDueDate(null);
        setIsIssuing(false);
        onNotify(`Borrowed "${book?.title}" to ${user?.name}`, 'success');
        refreshData();
    } catch (e) {
        onNotify("Failed to issue book", "error");
    }
  };

  const handleReturn = async (condition: ReturnCondition) => {
    if (!selectedTx) return;

    let copyStatus = CopyStatus.AVAILABLE;
    if (condition === ReturnCondition.DAMAGED) copyStatus = CopyStatus.DAMAGED;
    if (condition === ReturnCondition.LOST) copyStatus = CopyStatus.LOST;

    const completedTx: Transaction = {
      ...selectedTx,
      status: TransactionStatus.RETURNED,
      returnDate: new Date().toISOString(),
      returnCondition: condition,
    };

    try {
        await db.completeTransaction(completedTx, copyStatus);
        
        const book = books.find(b => b.id === selectedTx.bookId);
        if (book) {
            let action = 'RETURNED';
            if (condition === ReturnCondition.DAMAGED) action = 'RETURNED_DAMAGED';
            if (condition === ReturnCondition.LOST) action = 'MARKED_LOST';

            await db.addLog({
                id: crypto.randomUUID(),
                bookId: book.id,
                bookTitle: book.title,
                action: action,
                description: `Copy #${selectedTx.copyId} returned by ${selectedTx.userName}. Condition: ${condition}.`,
                timestamp: new Date().toISOString(),
                userId: selectedTx.userId,
                userName: selectedTx.userName,
                staffId: currentUser.id,
                staffName: currentUser.name
            });
        }

        refreshData();
        setSelectedTx(null);
        onNotify(`Book returned as ${condition}`, condition === 'GOOD' ? 'success' : 'info');
    } catch (e) {
        onNotify("Failed to process return", "error");
    }
  };

  const handleRenew = async () => {
    if (!selectedTx) return;
    
    const userRole = getUserRole(selectedTx.userId);
    const duration = getDurationForType(userRole);
    
    const currentDue = new Date(selectedTx.dueDate);
    currentDue.setDate(currentDue.getDate() + duration);
    const newDueDate = currentDue.toISOString();

    const updatedTx: Transaction = {
        ...selectedTx,
        dueDate: newDueDate
    };

    try {
        await db.updateTransaction(updatedTx);
        
        const book = books.find(b => b.id === selectedTx.bookId);
        if (book) {
            await db.addLog({
                id: crypto.randomUUID(),
                bookId: book.id,
                bookTitle: book.title,
                action: 'RENEWED',
                description: `Loan renewed for ${duration} days. New due date: ${currentDue.toLocaleDateString()}.`,
                timestamp: new Date().toISOString(),
                userId: selectedTx.userId,
                userName: selectedTx.userName,
                staffId: currentUser.id,
                staffName: currentUser.name
            });
        }

        refreshData();
        setSelectedTx(null);
        onNotify(`Loan renewed. New due date: ${currentDue.toLocaleDateString()}`, 'success');
    } catch (e) {
        onNotify("Failed to renew loan", "error");
    }
  };

  const clearFilters = () => {
      setFilterLenderType('');
      setFilterLentStart('');
      setFilterLentEnd('');
      setFilterReturnOption('');
      setSearch('');
  };

  const filteredTransactions = activeTransactions.filter(t => {
    // 1. Search Filter
    const s = search.toLowerCase();
    const bookTitle = books.find(b => b.id === t.bookId)?.title.toLowerCase() || '';
    
    const matchesSearch = (
      t.userName.toLowerCase().includes(s) || 
      t.userId.toLowerCase().includes(s) || 
      t.copyId.toLowerCase().includes(s) ||
      bookTitle.includes(s)
    );

    if (!matchesSearch) return false;

    // 2. Lender Type Filter
    if (filterLenderType) {
        const role = getUserRole(t.userId);
        if (role !== filterLenderType) return false;
    }

    // 3. Lent On (Issue Date) Range
    if (filterLentStart) {
        const txDate = new Date(t.issueDate).setHours(0,0,0,0);
        const filterDate = new Date(filterLentStart).setHours(0,0,0,0);
        if (txDate < filterDate) return false;
    }
    if (filterLentEnd) {
        const txDate = new Date(t.issueDate).setHours(0,0,0,0);
        const filterDate = new Date(filterLentEnd).setHours(0,0,0,0);
        if (txDate > filterDate) return false;
    }

    // 4. Return On (Due Date) - Next X Days
    if (filterReturnOption !== '') {
        const days = parseInt(filterReturnOption);
        const due = new Date(t.dueDate);
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const futureLimit = new Date(now);
        futureLimit.setDate(futureLimit.getDate() + days);
        futureLimit.setHours(23,59,59,999);

        // Filter: Show everything due between Today and Future Limit.
        if (due < now || due > futureLimit) return false;
    }

    return true;
  });
  
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Circulation Desk</h2>
           <p className="text-slate-500 text-sm">Manage active loans and returns</p>
        </div>
        <Button onClick={() => {
            setIsIssuing(true);
            setLenderId(''); setLenderName(''); setLenderType('');
            setBookSearchTerm(''); setSelectedCopy(null); setCalculatedDueDate(null);
        }}>
            <Plus className="w-4 h-4 mr-2" /> New Loan
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-sm border border-slate-200">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-3 items-end">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search loans..."
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm w-56"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 ml-1">Lender Type</label>
                <select 
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white min-w-[140px]"
                    value={filterLenderType}
                    onChange={(e) => setFilterLenderType(e.target.value)}
                >
                    <option value="">All Types</option>
                    {settings?.lenderTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 ml-1">Return Due</label>
                <select 
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white min-w-[140px]"
                    value={filterReturnOption}
                    onChange={(e) => setFilterReturnOption(e.target.value)}
                >
                    <option value="">Any Time</option>
                    {settings?.returnFilterOptions?.map((opt, idx) => (
                        <option key={idx} value={opt.days}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 ml-1">Lent From</label>
                <input 
                    type="date"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    value={filterLentStart}
                    onChange={(e) => setFilterLentStart(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 ml-1">To</label>
                <input 
                    type="date"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    value={filterLentEnd}
                    onChange={(e) => setFilterLentEnd(e.target.value)}
                />
            </div>
            
            {(filterLenderType || filterLentStart || filterLentEnd || filterReturnOption || search) && (
                 <button 
                    onClick={clearFilters}
                    className="ml-auto text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 px-3 py-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    <X size={14} /> Clear
                </button>
            )}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4">Book Details</th>
                <th className="px-6 py-4">Borrower</th>
                <th className="px-6 py-4">Lent On</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                 <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No active loans found matching your criteria.
                    </td>
                 </tr>
              ) : filteredTransactions.map(tx => {
                const book = books.find(b => b.id === tx.bookId);
                const overdueDays = getDaysOverdue(tx.dueDate);
                const isOverdue = overdueDays > 0;

                return (
                  <tr 
                    key={tx.id} 
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{book?.title || 'Unknown Title'}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">Barcode: {tx.copyId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <UserIcon size={14} />
                         </div>
                         <div>
                            <div className="text-slate-900">{tx.userName}</div>
                            <Badge color="gray">{getUserRole(tx.userId)}</Badge>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                        {new Date(tx.issueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={14} />
                        {new Date(tx.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        {isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                                <AlertCircle size={12} />
                                Late by {overdueDays} days
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-medium">
                                <Clock size={12} />
                                On Time
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <Button variant="secondary" className="text-xs px-3 py-1.5">Manage</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between">
            <span>Showing {filteredTransactions.length} records</span>
            {filterReturnOption && <span>Filtered by Return Date</span>}
        </div>
      </Card>

      <Modal
        isOpen={isIssuing}
        onClose={() => setIsIssuing(false)}
        title="Issue New Book"
      >
         {/* Modal content largely same structure, uses state driven by useEffects */}
         <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                      <h4 className="font-semibold text-slate-800 text-sm">Lender Details</h4>
                      <span className="text-xs text-slate-500">Auto-fill if ID exists</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                       <Input 
                            label="Lender ID *" 
                            placeholder="Enter ID & Tab..." 
                            value={lenderId}
                            onChange={(e) => setLenderId(e.target.value)}
                            onBlur={handleUserLookup}
                       />
                       <Select 
                            label="Lender Type *" 
                            value={lenderType}
                            onChange={(e) => handleLenderTypeChange(e.target.value)}
                       >
                            <option value="">Select Type...</option>
                            {settings?.lenderTypes.map(type => (
                                <option key={type.name} value={type.name}>{type.name}</option>
                            ))}
                       </Select>
                  </div>
                  <Input 
                        label="Lender Name *" 
                        placeholder="Full Name" 
                        value={lenderName}
                        onChange={(e) => setLenderName(e.target.value)}
                   />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Book Search</label>
                
                {!selectedCopy ? (
                    <div className="relative">
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                placeholder="Scan Barcode, or type Title / ISBN..."
                                value={bookSearchTerm}
                                onChange={(e) => setBookSearchTerm(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                autoFocus
                            />
                        </div>
                        {bookSearchTerm && matchingCopies.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {matchingCopies.map(match => (
                                    <div 
                                        key={match.copy.id}
                                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                        onClick={() => selectCopy(match)}
                                    >
                                        <div className="font-medium text-slate-800 flex justify-between">
                                            <span>{match.book.title}</span>
                                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">#{match.copy.id}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {match.book.authors[0]} • ISBN: {match.book.isbn}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                         {bookSearchTerm && matchingCopies.length === 0 && (
                             <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm text-slate-500 text-center">
                                 No available copies found.
                             </div>
                         )}
                    </div>
                ) : (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex justify-between items-center animate-in fade-in">
                        <div>
                             <p className="font-bold text-green-900">{selectedCopy.book.title}</p>
                             <div className="text-xs text-green-700 flex gap-2 mt-1">
                                <span className="font-mono bg-white/50 px-1 rounded">#{selectedCopy.copy.id}</span>
                                <span>{selectedCopy.book.authors[0]}</span>
                             </div>
                        </div>
                        <button 
                            onClick={() => { setSelectedCopy(null); setBookSearchTerm(''); }}
                            className="p-2 hover:bg-green-100 rounded-full text-green-700 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
              </div>

              {calculatedDueDate && (
                  <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-800 p-3 rounded-lg">
                      <Calendar className="w-4 h-4" />
                      <span>Expected Return Date: <strong>{calculatedDueDate.toLocaleDateString()}</strong> ({getDurationForType(lenderType)} days)</span>
                  </div>
              )}

              <div className="pt-2">
                <Button className="w-full py-3" onClick={handleLend}>Confirm Issue</Button>
              </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Manage Loan"
      >
        {selectedTx && (() => {
            const book = books.find(b => b.id === selectedTx.bookId);
            const overdueDays = getDaysOverdue(selectedTx.dueDate);
            const isOverdue = overdueDays > 0;

            return (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="font-bold text-slate-900 mb-2">{book?.title}</h4>
                        <div className="text-sm space-y-1 text-slate-600">
                           <div className="flex justify-between">
                             <span>Borrower:</span>
                             <span className="font-medium text-slate-900">{selectedTx.userName}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Issued:</span>
                             <span>{new Date(selectedTx.issueDate).toLocaleDateString()}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Due Date:</span>
                             <span className={isOverdue ? "text-red-600 font-bold" : ""}>{new Date(selectedTx.dueDate).toLocaleDateString()}</span>
                           </div>
                           {isOverdue && (
                               <div className="flex justify-between text-red-600 font-medium">
                                   <span>Status:</span>
                                   <span>Overdue by {overdueDays} days</span>
                               </div>
                           )}
                        </div>
                    </div>
                    
                    <div>
                        <h5 className="font-medium text-slate-900 mb-3">Actions</h5>
                        
                        <div className="mb-4">
                             <button 
                                onClick={handleRenew}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                             >
                                <RotateCw size={18} />
                                Renew Loan
                             </button>
                             <p className="text-xs text-center text-slate-500 mt-2">
                                Extends due date by {getDurationForType(getUserRole(selectedTx.userId))} days.
                             </p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Return Book</p>
                            <button 
                                onClick={() => handleReturn(ReturnCondition.GOOD)}
                                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all group"
                            >
                                <span className="flex items-center gap-2">
                                    <CheckCircle className="text-slate-400 group-hover:text-green-600" size={18} />
                                    <span className="font-medium">Return in Good Condition</span>
                                </span>
                            </button>
                            
                            <button 
                                onClick={() => handleReturn(ReturnCondition.DAMAGED)}
                                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all group"
                            >
                                <span className="flex items-center gap-2">
                                    <AlertTriangle className="text-slate-400 group-hover:text-amber-600" size={18} />
                                    <span className="font-medium">Return as Damaged</span>
                                </span>
                            </button>

                            <button 
                                onClick={() => handleReturn(ReturnCondition.LOST)}
                                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all group"
                            >
                                <span className="flex items-center gap-2">
                                    <XCircle className="text-slate-400 group-hover:text-red-600" size={18} />
                                    <span className="font-medium">Mark as Lost</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}
      </Modal>
    </div>
  );
};
