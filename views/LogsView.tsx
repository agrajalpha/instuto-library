import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/storage';
import { Log, Book } from '../types';
import { Card, Badge, Input, Button } from '../components/Shared';
import { Search, Calendar, User as UserIcon, BookOpen, Clock, ArrowRight, Activity, Filter, ChevronLeft, ChevronRight, History, Download, Loader2 } from 'lucide-react';

interface LogsViewProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface BookWithLogs {
  book: Book;
  latestLog: Log | null;
  logCount: number;
}

export const LogsView: React.FC<LogsViewProps> = ({ onNotify }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [fetchedLogs, fetchedBooks] = await Promise.all([
                db.getLogs(),
                db.getBooks()
            ]);
            setLogs(fetchedLogs);
            setBooks(fetchedBooks);
        } catch (e) {
            onNotify("Failed to load logs", "error");
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  // Group logs by book and find the latest entry
  const booksWithActivity = useMemo(() => {
    const grouped = new Map<string, Log[]>();
    
    logs.forEach(log => {
      if (!log.bookId) return;
      if (!grouped.has(log.bookId)) {
        grouped.set(log.bookId, []);
      }
      grouped.get(log.bookId)?.push(log);
    });

    const result: BookWithLogs[] = books.map(book => {
      const bookLogs = grouped.get(book.id) || [];
      // Sort logs desc
      bookLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return {
        book,
        latestLog: bookLogs[0] || null,
        logCount: bookLogs.length
      };
    });

    return result.sort((a, b) => {
        const timeA = a.latestLog ? new Date(a.latestLog.timestamp).getTime() : 0;
        const timeB = b.latestLog ? new Date(b.latestLog.timestamp).getTime() : 0;
        return timeB - timeA;
    });
  }, [books, logs]);

  // Filter and Pagination
  const filteredList = useMemo(() => {
    if (!search) return booksWithActivity;
    const s = search.toLowerCase();
    return booksWithActivity.filter(item => 
      item.book.title.toLowerCase().includes(s) ||
      item.latestLog?.description.toLowerCase().includes(s) ||
      item.latestLog?.userName?.toLowerCase().includes(s)
    );
  }, [booksWithActivity, search]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const selectedBookData = useMemo(() => {
    if (!selectedBookId) return null;
    return booksWithActivity.find(b => b.book.id === selectedBookId);
  }, [booksWithActivity, selectedBookId]);

  const selectedBookLogs = useMemo(() => {
    if (!selectedBookId) return [];
    return logs
        .filter(l => l.bookId === selectedBookId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, selectedBookId]);

  // Helpers
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    });
  };

  const getActionColor = (action: string) => {
      if (action.includes('BORROWED')) return 'blue';
      if (action.includes('RETURNED')) return 'green';
      if (action.includes('LOST') || action.includes('DAMAGED') || action.includes('WITHDRAWN') || action.includes('DELETED')) return 'red';
      if (action.includes('CREATED') || action.includes('ADDED')) return 'yellow';
      return 'gray';
  };

  const handleExport = () => {
    const dataToExport = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const headers = ['Timestamp', 'Action', 'Book Title', 'User', 'Description', 'Log ID'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(log => {
        const row = [
          `"${new Date(log.timestamp).toLocaleString().replace(/"/g, '""')}"`,
          `"${log.action}"`,
          `"${(log.bookTitle || 'Unknown').replace(/"/g, '""')}"`,
          `"${(log.userName || '-').replace(/"/g, '""')}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          log.id
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `instuto_system_logs_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    onNotify('Logs exported to CSV', 'success');
  };

  const handleBookExport = () => {
    if (!selectedBookData) return;
    const dataToExport = [...selectedBookLogs];
    const headers = ['Timestamp', 'Action', 'Book Title', 'User', 'Description', 'Log ID'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(log => {
        const row = [
          `"${new Date(log.timestamp).toLocaleString().replace(/"/g, '""')}"`,
          `"${log.action}"`,
          `"${(log.bookTitle || 'Unknown').replace(/"/g, '""')}"`,
          `"${(log.userName || '-').replace(/"/g, '""')}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          log.id
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeTitle = selectedBookData.book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `logs_${safeTitle}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    onNotify('Book logs exported to CSV', 'success');
  };
  
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="flex h-full gap-6">
      {/* Left Pane: List */}
      <div className={`${selectedBookId ? 'w-1/2 hidden md:flex' : 'w-full'} flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5" /> Activity Logs
                </h2>
                <Button variant="secondary" onClick={handleExport} className="px-3 py-1.5 h-auto text-xs">
                    <Download className="w-3 h-3 mr-2" /> Export All
                </Button>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search logs by book, user or activity..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                />
            </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
            {paginatedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    No activity logs found.
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {paginatedList.map(({ book, latestLog, logCount }) => (
                        <div 
                            key={book.id}
                            onClick={() => setSelectedBookId(book.id)}
                            className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors group ${selectedBookId === book.id ? 'bg-blue-50 border-l-4 border-l-blue-500 pl-3' : 'bg-white border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h3 className={`font-medium text-sm ${selectedBookId === book.id ? 'text-blue-700' : 'text-slate-900'}`}>
                                    {book.title}
                                </h3>
                                {latestLog && (
                                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                        <Clock size={10} /> {formatTime(latestLog.timestamp)}
                                    </span>
                                )}
                            </div>
                            
                            {latestLog ? (
                                <div className="flex items-start gap-3 mt-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge color={getActionColor(latestLog.action)}>
                                                {latestLog.action.replace('_', ' ')}
                                            </Badge>
                                            <span className="text-xs text-slate-500 truncate">
                                                by {latestLog.userName || 'System'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-1">
                                            {latestLog.description}
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold" title="Total Logs">
                                        {logCount}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic mt-1">No recorded activity</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-100 bg-white flex justify-between items-center text-sm">
             <div className="text-slate-500">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages || 1}</span>
             </div>
             <div className="flex gap-1">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
                >
                    <ChevronLeft size={18} />
                </button>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
                >
                    <ChevronRight size={18} />
                </button>
             </div>
        </div>
      </div>

      {/* Right Pane: Timeline Details */}
      {selectedBookData && (
          <div className="w-full md:w-1/2 flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
             {/* Header */}
             <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                 <div className="flex justify-between items-start mb-2">
                     <h2 className="text-lg font-bold text-slate-900 leading-tight">{selectedBookData.book.title}</h2>
                     <div className="flex gap-2">
                         <Button variant="secondary" onClick={handleBookExport} className="px-2 py-1 h-8 text-xs">
                            <Download className="w-3 h-3 mr-1" /> Export
                         </Button>
                         <button onClick={() => setSelectedBookId(null)} className="md:hidden p-1 bg-white rounded border border-slate-200 text-slate-500">Close</button>
                     </div>
                 </div>
                 <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                     <span className="flex items-center gap-1"><UserIcon size={12} /> {selectedBookData.book.authors.join(', ')}</span>
                     <span className="flex items-center gap-1"><BookOpen size={12} /> {selectedBookData.book.isbn}</span>
                 </div>
             </div>

             {/* Timeline */}
             <div className="flex-1 overflow-y-auto p-6 bg-white">
                <div className="relative pl-4 border-l-2 border-slate-100 space-y-8">
                    {selectedBookLogs.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-4">No history available for this book.</div>
                    ) : (
                        selectedBookLogs.map((log, index) => (
                            <div key={log.id} className="relative animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 ${
                                    log.action.includes('BORROWED') ? 'bg-blue-500' :
                                    log.action.includes('RETURNED') ? 'bg-green-500' :
                                    log.action.includes('WITHDRAWN') || log.action.includes('LOST') ? 'bg-red-500' : 'bg-amber-500'
                                }`}></div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-400">
                                            {new Date(log.timestamp).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs font-mono text-slate-300">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-sm text-slate-700 capitalize">
                                                {log.action.replace('_', ' ').toLowerCase()}
                                            </span>
                                            {log.userName && (
                                                <Badge color="gray">{log.userName}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1">
                                            {log.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
             </div>
          </div>
      )}
    </div>
  );
};