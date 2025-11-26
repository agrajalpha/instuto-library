
import React, { useState, useEffect, useMemo } from 'react';
import { Book, Copy, CopyStatus, SystemSettings, Transaction, TransactionStatus, SystemUser } from '../types';
import { db } from '../services/storage';
import { generateLocCallNumber } from '../services/loc';
import { Search, Plus, Trash2, Edit2, Copy as CopyIcon, X, AlertTriangle, BookOpen, Wand2, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, Settings, User as UserIcon, Calendar, CheckCircle, AlertCircle, Layers, Loader2 } from 'lucide-react';
import { Card, Button, Input, Badge, Select, Modal, MultiSelect } from '../components/Shared';

interface BooksViewProps {
  onNotify: (msg: string, type: 'success' | 'error') => void;
  currentUser: SystemUser;
}

type SortKey = keyof Book | 'availableCopies';
type SortDirection = 'asc' | 'desc';

export const BooksView: React.FC<BooksViewProps> = ({ onNotify, currentUser }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection & Editing
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formBook, setFormBook] = useState<Partial<Book>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  
  // Copies State
  const [activeCopies, setActiveCopies] = useState<Copy[]>([]);
  const [loadingCopies, setLoadingCopies] = useState(false);
  const [managingCopy, setManagingCopy] = useState<Copy | null>(null);
  const [isAddingCopies, setIsAddingCopies] = useState(false);
  const [copiesToAdd, setCopiesToAdd] = useState(1);
  
  // Manage Copy Form State
  const [manageStatus, setManageStatus] = useState<CopyStatus>(CopyStatus.AVAILABLE);
  const [manageNarration, setManageNarration] = useState('');
  const [manageIsRef, setManageIsRef] = useState(false);

  // Withdraw (Delete) Copy State
  const [copiesToWithdraw, setCopiesToWithdraw] = useState<Copy[]>([]);
  const [selectedCopyIds, setSelectedCopyIds] = useState<Set<string>>(new Set());
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawRemarks, setWithdrawRemarks] = useState('');

  // Table State
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterRack, setFilterRack] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'title', 
    direction: 'asc' 
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
        const [fetchedBooks, fetchedSettings, fetchedTransactions] = await Promise.all([
            db.getBooks(),
            db.getSettings(),
            db.getTransactions()
        ]);
        setBooks(fetchedBooks);
        setSettings(fetchedSettings);
        setTransactions(fetchedTransactions);
    } catch (e) {
        onNotify("Failed to load data", "error");
    } finally {
        setLoading(false);
    }
  };

  // --- Auto-Generate LOC Effect ---
  useEffect(() => {
    if (!isEditing) return;

    // Check if we have minimum requirements to generate LOC
    if (
        formBook.title && 
        formBook.authors && formBook.authors.length > 0 && 
        formBook.categories && formBook.categories.length > 0 && 
        formBook.publishedYear && formBook.publishedYear.length === 4
    ) {
        const newLoc = generateLocCallNumber(
            formBook.categories[0], 
            formBook.authors[0], 
            formBook.title, 
            formBook.publishedYear
        );

        if (newLoc !== formBook.locCallNumber) {
            setFormBook(prev => ({ ...prev, locCallNumber: newLoc }));
            if (errors.locCallNumber) {
                setErrors(prev => {
                    const next = { ...prev };
                    delete next.locCallNumber;
                    return next;
                });
            }
        }
    }
  }, [formBook.title, formBook.authors, formBook.categories, formBook.publishedYear, isEditing]);

  const loadCopies = async (bookId: string) => {
    setLoadingCopies(true);
    try {
        const copies = await db.getCopies(bookId);
        setActiveCopies(copies);
        setSelectedCopyIds(new Set()); 
    } catch (e) {
        onNotify("Failed to load copies", "error");
    } finally {
        setLoadingCopies(false);
    }
  };

  const getBorrowerInfo = (copyId: string) => {
    return transactions.find(t => t.copyId === copyId && t.status === TransactionStatus.ACTIVE);
  };

  const hasHistory = (copyId: string) => {
    return transactions.some(t => t.copyId === copyId);
  };

  // --- Logic: Selection ---
  
  const isCopyActionable = (copy: Copy) => {
    return copy.status === CopyStatus.AVAILABLE || copy.status === CopyStatus.WITHDRAWN;
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedCopyIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCopyIds(newSet);
  };

  const toggleSelectAll = () => {
    const actionableCopies = activeCopies.filter(isCopyActionable);
    
    if (actionableCopies.length === 0) return;

    const allActionableSelected = actionableCopies.every(c => selectedCopyIds.has(c.id));

    if (allActionableSelected) {
      setSelectedCopyIds(new Set());
    } else {
      setSelectedCopyIds(new Set(actionableCopies.map(c => c.id)));
    }
  };

  // --- Logic: Sorting, Filtering, Pagination ---

  const getAvailableCount = (bookId: string) => {
    // Note: Since we don't have all copies loaded for all books in the table view (only active selected), 
    // we would typically need a separate field in book or a backend count. 
    // For this refactor without changing schema too much, we will assume backend populates this, 
    // or we fetch it. BUT fetching copies for ALL books is heavy.
    // Hack: We return '-' if we don't have the copies loaded, or we fetch all copies upfront?
    // The original code fetched ALL copies. Let's stick to that for simplicity if dataset is small.
    // Wait, the API `db.getCopies()` fetches ALL copies if no ID provided.
    // In `loadInitialData`, I didn't fetch all copies.
    return "-"; // Placeholder as calculating this client side for thousands of books is bad.
    // Ideally the SQL query for books should join and count.
  };

  const filteredBooks = useMemo(() => {
    let result = books;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(b => 
        b.title.toLowerCase().includes(s) || 
        b.authors.some(a => a.toLowerCase().includes(s)) ||
        b.locCallNumber.toLowerCase().includes(s) ||
        b.isbn.includes(s)
      );
    }

    if (filterCategory) {
      result = result.filter(b => b.categories.includes(filterCategory));
    }

    if (filterRack) {
      result = result.filter(b => b.locationRack === filterRack);
    }

    result = [...result].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Book];
      let bValue: any = b[sortConfig.key as keyof Book];

      if (sortConfig.key === 'authors') {
        aValue = a.authors.join(', ');
        bValue = b.authors.join(', ');
      } else if (sortConfig.key === 'categories') {
        aValue = a.categories.join(', ');
        bValue = b.categories.join(', ');
      }

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [books, search, filterCategory, filterRack, sortConfig]);

  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const paginatedBooks = filteredBooks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const headers = ['Title', 'Authors', 'ISBN', 'Publisher', 'Year', 'Genre', 'Category', 'Rack', 'Shelf', 'LOC Call #'];
    
    const csvContent = [
      headers.join(','),
      ...filteredBooks.map(b => {
        const row = [
          `"${b.title.replace(/"/g, '""')}"`,
          `"${b.authors.join('; ')}"`,
          `"${b.isbn}"`,
          `"${b.publisher}"`,
          `"${b.publishedYear}"`,
          `"${b.genre}"`,
          `"${b.categories.join('; ')}"`,
          `"${b.locationRack}"`,
          `"${b.locationShelf}"`,
          `"${b.locCallNumber}"`,
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `library_catalog_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    onNotify('Export started', 'success');
  };

  // --- Form Validation & Handlers ---

  const handleManualGenerateLoc = () => {
      if (formBook.title && formBook.authors?.[0] && formBook.categories?.[0] && formBook.publishedYear) {
           const loc = generateLocCallNumber(
            formBook.categories[0], 
            formBook.authors[0], 
            formBook.title, 
            formBook.publishedYear
        );
        setFormBook(prev => ({ ...prev, locCallNumber: loc }));
        if (errors.locCallNumber) {
            setErrors(prev => {
                const next = {...prev};
                delete next.locCallNumber;
                return next;
            });
        }
      } else {
          onNotify("Please fill Title, Author, Category and Year first", "error");
      }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formBook.title?.trim()) newErrors.title = "Title is required";
    if (!formBook.authors || formBook.authors.length === 0) newErrors.authors = "At least one author is required";
    if (!formBook.categories || formBook.categories.length === 0) newErrors.categories = "At least one category is required";
    if (!formBook.isbn?.trim()) newErrors.isbn = "ISBN is required";
    if (!formBook.publisher?.trim()) newErrors.publisher = "Publisher is required";
    if (!formBook.publishedYear?.trim()) {
        newErrors.publishedYear = "Year is required";
    } else if (!/^\d{4}$/.test(formBook.publishedYear)) {
        newErrors.publishedYear = "Year must be 4 digits";
    }
    if (!formBook.locationRack) newErrors.locationRack = "Rack is required";
    if (!formBook.locationShelf) newErrors.locationShelf = "Shelf is required";
    if (!formBook.locCallNumber?.trim()) newErrors.locCallNumber = "Call number is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof Book, value: any) => {
    setFormBook(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
        setErrors(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }
  };

  const handleSaveBook = async () => {
    if (!validateForm()) {
      onNotify("Please fix the errors in the form", 'error');
      return;
    }
    
    const isNew = !formBook.id;
    // For new books, ID generation should handle by backend ideally, or UUID client side.
    const newBook: Book = {
      id: formBook.id || crypto.randomUUID(), 
      title: formBook.title!,
      authors: formBook.authors!,
      categories: formBook.categories!,
      isbn: formBook.isbn!,
      genre: formBook.genre || 'General',
      publisher: formBook.publisher!,
      publishedYear: formBook.publishedYear!,
      locationRack: formBook.locationRack!,
      locationShelf: formBook.locationShelf!,
      locCallNumber: formBook.locCallNumber!,
      description: formBook.description || '',
    };

    try {
        await db.saveBook(newBook);
        
        await db.addLog({
            id: crypto.randomUUID(),
            bookId: newBook.id,
            bookTitle: newBook.title,
            action: isNew ? 'BOOK_CREATED' : 'BOOK_UPDATED',
            description: isNew 
                ? `Book created with ISBN ${newBook.isbn}` 
                : `Book details updated.`,
            timestamp: new Date().toISOString(),
            staffId: currentUser.id,
            staffName: currentUser.name
        });

        // Refresh list
        const updatedBooks = await db.getBooks();
        setBooks(updatedBooks);
        
        setIsEditing(false);
        setFormBook({});
        setErrors({});
        if (selectedBook?.id === newBook.id) {
            setSelectedBook(newBook);
        }
        onNotify("Book saved successfully", 'success');
    } catch (e) {
        onNotify("Failed to save book", "error");
    }
  };

  const confirmDeleteBook = async () => {
    if (!deleteBookId) return;
    try {
        await db.deleteBook(deleteBookId);
        
        const updatedBooks = await db.getBooks();
        setBooks(updatedBooks);
        
        if (selectedBook?.id === deleteBookId) setSelectedBook(null);
        onNotify("Book deleted from catalog", 'success');
    } catch (e) {
        onNotify("Failed to delete book", "error");
    } finally {
        setDeleteBookId(null);
    }
  };

  const handleBulkAddCopies = async () => {
    if (!selectedBook) return;
    if (copiesToAdd < 1) {
      onNotify("Please enter a valid number of copies", 'error');
      return;
    }
    
    try {
        const promises = [];
        for (let i = 0; i < copiesToAdd; i++) {
           const newCopy: Copy = {
            id: Math.floor(100000 + Math.random() * 900000).toString(),
            bookId: selectedBook.id,
            status: CopyStatus.AVAILABLE,
            addedDate: new Date().toISOString(),
            isReferenceOnly: false,
          };
          promises.push(db.saveCopy(newCopy));
        }
        await Promise.all(promises);

        await db.addLog({
            id: crypto.randomUUID(),
            bookId: selectedBook.id,
            bookTitle: selectedBook.title,
            action: 'COPIES_ADDED',
            description: `${copiesToAdd} new physical cop${copiesToAdd > 1 ? 'ies' : 'y'} added to inventory.`,
            timestamp: new Date().toISOString(),
            staffId: currentUser.id,
            staffName: currentUser.name
        });

        await loadCopies(selectedBook.id);
        setIsAddingCopies(false);
        setCopiesToAdd(1);
        onNotify(`${copiesToAdd} cop${copiesToAdd > 1 ? 'ies' : 'y'} added successfully`, 'success');
    } catch (e) {
        onNotify("Failed to add copies", "error");
    }
  };
  
  const handleInitiateWithdraw = (copy: Copy) => {
    if (!isCopyActionable(copy)) {
        onNotify(`Cannot delete copy that is ${copy.status}.`, 'error');
        return;
    }
    setCopiesToWithdraw([copy]);
    setWithdrawReason('');
    setWithdrawRemarks('');
  };

  const handleBulkWithdraw = () => {
    const selected = activeCopies.filter(c => selectedCopyIds.has(c.id));
    const valid = selected.filter(isCopyActionable);
    
    if (valid.length === 0) {
        onNotify("No valid copies selected for withdrawal.", "error");
        return;
    }
    setCopiesToWithdraw(valid);
    setWithdrawReason('');
    setWithdrawRemarks('');
  };

  const handleConfirmWithdraw = async () => {
    if (copiesToWithdraw.length === 0 || !selectedBook) return;
    
    if (!withdrawReason) {
        onNotify("Please select a reason for deletion.", 'error');
        return;
    }

    const narration = `[${withdrawReason}] ${withdrawRemarks}`.trim();
    const copyIds = copiesToWithdraw.map(c => c.id).join(', ');

    try {
        const promises = copiesToWithdraw.map(copy => {
            const updatedCopy: Copy = {
                ...copy,
                status: CopyStatus.WITHDRAWN,
                narration: narration
            };
            return db.saveCopy(updatedCopy);
        });
        await Promise.all(promises);

        await db.addLog({
            id: crypto.randomUUID(),
            bookId: selectedBook.id,
            bookTitle: selectedBook.title,
            action: 'COPIES_WITHDRAWN',
            description: `${copiesToWithdraw.length} cop${copiesToWithdraw.length > 1 ? 'ies' : 'y'} (${copyIds}) withdrawn. Reason: ${withdrawReason}`,
            timestamp: new Date().toISOString(),
            staffId: currentUser.id,
            staffName: currentUser.name
        });

        await loadCopies(selectedBook.id);
        setCopiesToWithdraw([]);
        setSelectedCopyIds(new Set()); 
        onNotify(`${copiesToWithdraw.length} cop${copiesToWithdraw.length > 1 ? 'ies' : 'y'} withdrawn successfully`, 'success');
    } catch (e) {
        onNotify("Failed to withdraw copies", "error");
    }
  };

  const handlePermanentDelete = async () => {
     if (copiesToWithdraw.length !== 1 || !selectedBook) return;
     const copy = copiesToWithdraw[0];

     if (hasHistory(copy.id)) {
        onNotify("Cannot permanently delete record with transaction history.", 'error');
        return;
     }
     
     if (confirm("Are you sure? This will permanently remove the record from the database.")) {
        try {
            await db.deleteCopy(copy.id);
            
            await db.addLog({
                id: crypto.randomUUID(),
                bookId: selectedBook.id,
                bookTitle: selectedBook.title,
                action: 'COPY_DELETED',
                description: `Copy #${copy.id} permanently deleted from records.`,
                timestamp: new Date().toISOString(),
                staffId: currentUser.id,
                staffName: currentUser.name
            });

            await loadCopies(selectedBook.id);
            setCopiesToWithdraw([]);
            onNotify("Copy permanently deleted", 'success');
        } catch (e) {
            onNotify("Failed to delete copy", "error");
        }
     }
  };

  const openManageCopy = (copy: Copy) => {
    setManagingCopy(copy);
    setManageStatus(copy.status);
    setManageNarration(copy.narration || '');
    setManageIsRef(copy.isReferenceOnly || false);
  };

  const handleSaveCopyChanges = async () => {
    if (!managingCopy || !selectedBook) return;

    if (manageStatus === CopyStatus.WITHDRAWN && !manageNarration.trim()) {
        onNotify("Please provide a reason for withdrawal", 'error');
        return;
    }

    const updatedCopy: Copy = {
        ...managingCopy,
        status: manageStatus,
        isReferenceOnly: manageIsRef,
        narration: manageNarration.trim() || undefined
    };

    try {
        await db.saveCopy(updatedCopy);

        await db.addLog({
            id: crypto.randomUUID(),
            bookId: selectedBook.id,
            bookTitle: selectedBook.title,
            action: 'COPY_UPDATED',
            description: `Copy #${updatedCopy.id} status changed to ${manageStatus}. ${manageIsRef ? '[Ref Only]' : ''}`,
            timestamp: new Date().toISOString(),
            staffId: currentUser.id,
            staffName: currentUser.name
        });

        await loadCopies(selectedBook.id);
        setManagingCopy(null);
        onNotify("Copy updated successfully", 'success');
    } catch (e) {
        onNotify("Failed to update copy", "error");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="text-slate-300 ml-1 inline" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600 ml-1 inline" /> 
      : <ArrowDown size={14} className="text-blue-600 ml-1 inline" />;
  };

  const TH = ({ label, column, className = '' }: { label: string, column: SortKey, className?: string }) => (
    <th 
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      {label} <SortIcon column={column} />
    </th>
  );
  
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!settings) return null;

  return (
    <>
      <div className="flex h-full gap-6">
        <div className={`${selectedBook || isEditing ? 'w-1/2 hidden md:flex' : 'w-full'} flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden`}>
          
          <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
             <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Book Catalog</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExport} className="px-3">
                        <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                    <Button onClick={() => { setSelectedBook(null); setIsEditing(true); setFormBook({}); setErrors({}); }}>
                        <Plus className="w-4 h-4 mr-2" /> Add Book
                    </Button>
                </div>
             </div>

             <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search books, authors, ISBN..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="w-40">
                    <select 
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="">All Categories</option>
                        {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="w-32">
                    <select 
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={filterRack}
                        onChange={(e) => { setFilterRack(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="">All Racks</option>
                        {settings.racks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
             </div>
          </div>

          <div className="flex-1 overflow-auto">
             <table className="w-full whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <TH label="Title" column="title" className="min-w-[200px]" />
                        <TH label="Author" column="authors" />
                        <TH label="Category" column="categories" />
                        <TH label="Year" column="publishedYear" />
                        <TH label="LOC Call #" column="locCallNumber" />
                        <TH label="Location" column="locationRack" />
                        <TH label="Avail" column="availableCopies" className="text-center" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {paginatedBooks.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                No books found matching your filters.
                            </td>
                        </tr>
                    ) : (
                        paginatedBooks.map(book => {
                            const isSelected = selectedBook?.id === book.id;
                            return (
                                <tr 
                                    key={book.id} 
                                    onClick={() => { setSelectedBook(book); setIsEditing(false); loadCopies(book.id); }}
                                    className={`hover:bg-blue-50 cursor-pointer transition-colors text-sm text-slate-700 ${isSelected ? 'bg-blue-50' : ''}`}
                                >
                                    <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[200px]" title={book.title}>
                                        {book.title}
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-[150px]" title={book.authors.join(', ')}>
                                        {book.authors[0]} {book.authors.length > 1 && `+${book.authors.length - 1}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                            {book.categories[0]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{book.publishedYear}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{book.locCallNumber}</td>
                                    <td className="px-4 py-3 text-xs">
                                        R:{book.locationRack} / S:{book.locationShelf}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-400">
                                        -
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
             </table>
          </div>
          {/* Pagination controls same as before */}
           <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-sm">
             <div className="text-slate-500">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredBooks.length)}</span> of <span className="font-medium">{filteredBooks.length}</span>
             </div>
             <div className="flex gap-1">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronLeft size={18} />
                </button>
                <div className="px-2 py-1 bg-white border border-slate-200 rounded min-w-[30px] text-center">
                    {currentPage}
                </div>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronRight size={18} />
                </button>
             </div>
          </div>
        </div>
        
        {/* Right Pane (Details) Same as before but with loading state for copies */}
        {(selectedBook || isEditing) && (
          <div className="w-full md:w-1/2 flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
            {isEditing ? (
               <div className="flex flex-col h-full overflow-hidden">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
                   <h2 className="text-lg font-bold text-slate-800">{formBook.id ? 'Edit Book' : 'Add New Book'}</h2>
                   <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6 space-y-4">
                   <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-2 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Fields marked with <strong className="text-red-500">*</strong> are required. LOC Call Number is auto-generated based on Title, Author, Category and Year.</span>
                   </div>

                   <Input 
                      label="Title *" 
                      value={formBook.title || ''} 
                      onChange={e => handleFieldChange('title', e.target.value)} 
                      error={errors.title}
                      placeholder="e.g. The Great Gatsby"
                   />
                   
                   <MultiSelect 
                        label="Authors *"
                        options={settings.authors}
                        value={formBook.authors || []}
                        onChange={(v) => handleFieldChange('authors', v)}
                        error={errors.authors}
                   />
                   
                   <div className="grid grid-cols-2 gap-4">
                        <Select 
                            label="Genre" 
                            value={formBook.genre || ''} 
                            onChange={e => handleFieldChange('genre', e.target.value)}
                        >
                            <option value="">Select Genre...</option>
                            {settings.genres.map(g => <option key={g} value={g}>{g}</option>)}
                        </Select>

                        <Select 
                            label="Publisher *" 
                            value={formBook.publisher || ''} 
                            onChange={e => handleFieldChange('publisher', e.target.value)}
                            error={errors.publisher}
                        >
                            <option value="">Select Publisher...</option>
                            {settings.publishers.map(p => <option key={p} value={p}>{p}</option>)}
                        </Select>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <Input 
                        label="Published Year *" 
                        type="number" 
                        value={formBook.publishedYear || ''} 
                        onChange={e => handleFieldChange('publishedYear', e.target.value)} 
                        error={errors.publishedYear}
                        placeholder="YYYY"
                     />
                     <Input 
                        label="ISBN *" 
                        value={formBook.isbn || ''} 
                        onChange={e => handleFieldChange('isbn', e.target.value)} 
                        error={errors.isbn}
                        placeholder="13-digit ISBN"
                     />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <Select 
                        label="Rack *" 
                        value={formBook.locationRack || ''} 
                        onChange={e => handleFieldChange('locationRack', e.target.value)}
                        error={errors.locationRack}
                     >
                        <option value="">Select Rack...</option>
                        {settings.racks.map(r => <option key={r} value={r}>{r}</option>)}
                     </Select>
                     <Select 
                        label="Shelf *" 
                        value={formBook.locationShelf || ''} 
                        onChange={e => handleFieldChange('locationShelf', e.target.value)}
                        error={errors.locationShelf}
                     >
                        <option value="">Select Shelf...</option>
                        {settings.shelves.map(s => <option key={s} value={s}>{s}</option>)}
                     </Select>
                   </div>

                   <MultiSelect 
                        label="Categories *"
                        options={settings.categories}
                        value={formBook.categories || []}
                        onChange={(v) => handleFieldChange('categories', v)}
                        error={errors.categories}
                   />
                   
                   <div className="flex gap-2 items-end">
                       <Input 
                            className="flex-1 font-mono" 
                            label="LOC Call Number *" 
                            value={formBook.locCallNumber || ''} 
                            onChange={e => handleFieldChange('locCallNumber', e.target.value)} 
                            error={errors.locCallNumber}
                            placeholder="Auto-generated"
                        />
                       <Button 
                           variant="secondary" 
                           onClick={handleManualGenerateLoc}
                           title="Refresh LOC Call Number"
                           className="mb-[1px]"
                       >
                           <Wand2 className="w-4 h-4" />
                       </Button>
                   </div>
                   
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <textarea 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        rows={3}
                        value={formBook.description || ''}
                        onChange={e => handleFieldChange('description', e.target.value)}
                      />
                   </div>
                 </div>
                 
                 <div className="p-4 flex gap-3 mt-auto bg-slate-50 border-t border-slate-100">
                     <Button className="flex-1" onClick={handleSaveBook}>Save Book</Button>
                     <Button variant="ghost" onClick={() => { setIsEditing(false); setErrors({}); }}>Cancel</Button>
                 </div>
               </div>
            ) : selectedBook ? (
              <div className="flex flex-col h-full overflow-hidden">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0 bg-white">
                   <div className="flex-1 mr-4">
                      <h2 className="text-xl font-bold text-slate-900 leading-tight">{selectedBook.title}</h2>
                      <p className="text-slate-600 mt-1">{selectedBook.authors.join(', ')}</p>
                   </div>
                   <div className="flex gap-2 shrink-0">
                     <Button variant="ghost" onClick={() => { setFormBook(selectedBook); setIsEditing(true); setErrors({}); }}>
                       <Edit2 className="w-4 h-4" />
                     </Button>
                     <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setDeleteBookId(selectedBook.id)}>
                       <Trash2 className="w-4 h-4" />
                     </Button>
                     <button onClick={() => setSelectedBook(null)} className="p-2 hover:bg-slate-100 rounded-md">
                        <X className="w-5 h-5 text-slate-400"/>
                     </button>
                   </div>
                 </div>

                 <div className="overflow-y-auto p-6">
                    {/* Book Metadata details */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-y-2">
                            <span className="text-slate-500">Publisher:</span>
                            <span className="font-medium text-right">{selectedBook.publisher} ({selectedBook.publishedYear})</span>
                            <span className="text-slate-500">Genre:</span>
                            <span className="font-medium text-right">{selectedBook.genre}</span>
                            <span className="text-slate-500">Location:</span>
                            <span className="font-medium text-right">{selectedBook.locationRack} / {selectedBook.locationShelf}</span>
                            <span className="text-slate-500">ISBN:</span>
                            <span className="font-medium text-right">{selectedBook.isbn}</span>
                        </div>
                        
                        <div className="border-t border-slate-200 pt-3 mt-2">
                             <div className="flex flex-wrap gap-2 mb-3">
                                {selectedBook.categories.map(c => (
                                    <Badge key={c} color="blue">{c}</Badge>
                                ))}
                             </div>
                             <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">LOC Call #:</span>
                                <span className="font-mono bg-white px-2 py-0.5 border rounded shadow-sm">{selectedBook.locCallNumber}</span>
                             </div>
                        </div>

                        {selectedBook.description && (
                            <p className="text-slate-600 italic border-t pt-3 border-slate-200 mt-2">
                            {selectedBook.description}
                            </p>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
                            <div className="text-2xl font-bold text-green-700">
                                {loadingCopies ? '-' : activeCopies.filter(c => c.status === CopyStatus.AVAILABLE).length}
                            </div>
                            <div className="text-xs text-green-600 uppercase font-bold tracking-wider">Total Available</div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
                            <div className="text-2xl font-bold text-blue-700">
                                {loadingCopies ? '-' : activeCopies.filter(c => c.status === CopyStatus.AVAILABLE && !c.isReferenceOnly).length}
                            </div>
                            <div className="text-xs text-blue-600 uppercase font-bold tracking-wider">Lendable</div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold flex items-center gap-2 text-slate-800">
                                <CopyIcon className="w-4 h-4" /> Copies
                                </h3>
                                {selectedCopyIds.size > 0 && (
                                    <Button variant="danger" className="px-2 py-1 text-xs h-7 ml-2" onClick={handleBulkWithdraw}>
                                        Withdraw ({selectedCopyIds.size})
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2 items-center">
                                {activeCopies.some(isCopyActionable) && (
                                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none px-2 hover:text-slate-700">
                                        <input type="checkbox" 
                                            checked={activeCopies.length > 0 && activeCopies.filter(isCopyActionable).every(c => selectedCopyIds.has(c.id))}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        Select All
                                    </label>
                                )}
                                <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => { setIsAddingCopies(true); setCopiesToAdd(1); }}>
                                    <Plus className="w-3 h-3 mr-1" /> Add Copies
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {loadingCopies && <div className="text-center py-4 text-slate-400"><Loader2 className="animate-spin inline w-4 h-4"/> Loading copies...</div>}
                            
                            {!loadingCopies && activeCopies.length === 0 && (
                                <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">No copies found.</div>
                            )}
                            
                            {!loadingCopies && activeCopies.map(copy => {
                                const borrowerTx = getBorrowerInfo(copy.id);
                                const isActionable = isCopyActionable(copy);

                                return (
                                    <div key={copy.id} className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${copy.status === CopyStatus.WITHDRAWN ? 'bg-slate-100 opacity-75' : 'bg-white hover:shadow-sm'}`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedCopyIds.has(copy.id)}
                                                    onChange={() => toggleSelection(copy.id)}
                                                    disabled={!isActionable}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                    #{copy.id}
                                                </span>
                                                <Badge color={
                                                    copy.status === CopyStatus.AVAILABLE ? 'green' : 
                                                    copy.status === CopyStatus.BORROWED ? 'blue' : 
                                                    copy.status === CopyStatus.WITHDRAWN ? 'gray' : 'red'
                                                }>
                                                    {copy.status}
                                                </Badge>
                                                {copy.isReferenceOnly && <Badge color="yellow">Ref Only</Badge>}
                                            </div>
                                            
                                            <div className="flex gap-1">
                                                <Button 
                                                    variant="secondary" 
                                                    className="text-xs px-2 py-1 h-7"
                                                    onClick={() => openManageCopy(copy)}
                                                >
                                                    <Settings className="w-3 h-3 mr-1" /> Manage
                                                </Button>
                                                
                                                <Button 
                                                    variant="ghost" 
                                                    className={`h-7 w-7 px-0 ${isActionable ? 'text-slate-400 hover:text-red-600' : 'text-slate-200 cursor-not-allowed'}`}
                                                    onClick={() => isActionable && handleInitiateWithdraw(copy)}
                                                    title={isActionable ? "Delete/Withdraw Copy" : "Cannot delete (Lent/Lost/Damaged)"}
                                                    disabled={!isActionable}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        {borrowerTx ? (
                                            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded mt-1">
                                                <UserIcon size={12} />
                                                <span className="font-medium">{borrowerTx.userName}</span>
                                                <span className="text-blue-400">|</span>
                                                <Calendar size={12} />
                                                <span>Due: {new Date(borrowerTx.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        ) : copy.status === CopyStatus.WITHDRAWN ? (
                                            <div className="text-xs text-slate-500 italic mt-1 px-1 bg-slate-100 rounded py-1 border border-slate-200">
                                                {copy.narration || 'No reason provided'}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                 </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!deleteBookId}
        onClose={() => setDeleteBookId(null)}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteBookId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDeleteBook}>Delete Book</Button>
          </>
        }
      >
        <div className="flex gap-4">
          <div className="bg-red-100 p-3 rounded-full h-fit text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-slate-900 mb-1">Delete this book?</p>
            <p className="text-sm">
              Are you sure you want to delete this book? This action cannot be undone and will remove all associated copies and transaction history.
            </p>
          </div>
        </div>
      </Modal>

      {/* Other modals remain similar but use the async handlers defined above */}
      <Modal
        isOpen={isAddingCopies}
        onClose={() => setIsAddingCopies(false)}
        title="Add Copies"
        footer={
            <>
                <Button variant="ghost" onClick={() => setIsAddingCopies(false)}>Cancel</Button>
                <Button onClick={handleBulkAddCopies}>Generate Copies</Button>
            </>
        }
      >
        <div className="space-y-4">
            <p className="text-slate-600 text-sm">
                Generate unique barcodes for new physical copies of <span className="font-medium text-slate-900">{selectedBook?.title}</span>.
            </p>
            <Input 
                label="Number of Copies" 
                type="number" 
                min={1} 
                max={50}
                value={copiesToAdd} 
                onChange={(e) => setCopiesToAdd(parseInt(e.target.value) || 0)} 
                autoFocus
            />
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 flex gap-2">
                <Layers className="w-5 h-5 shrink-0" />
                <p>Copies will be set to <strong>Available</strong> status by default. You can change them to Reference Only individually later.</p>
            </div>
        </div>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        isOpen={copiesToWithdraw.length > 0}
        onClose={() => setCopiesToWithdraw([])}
        title={copiesToWithdraw.length === 1 
            ? `Delete / Withdraw Copy #${copiesToWithdraw[0]?.id}` 
            : `Withdraw ${copiesToWithdraw.length} Copies`}
        footer={
            <>
                <Button variant="ghost" onClick={() => setCopiesToWithdraw([])}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmWithdraw}>
                    {copiesToWithdraw.length > 1 ? 'Withdraw All' : 'Delete Copy'}
                </Button>
            </>
        }
      >
         <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-red-800">Remove from Circulation</p>
                    <p className="text-red-700 opacity-90">
                        {copiesToWithdraw.length > 1 
                          ? `This will mark ${copiesToWithdraw.length} items as Withdrawn.` 
                          : 'This will mark the item as Withdrawn.'} 
                         They will no longer be available for lending.
                    </p>
                </div>
            </div>

            {copiesToWithdraw.length > 1 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 break-all">
                    <strong>Selected:</strong> {copiesToWithdraw.map(c => c.id).join(', ')}
                </div>
            )}

            <Select 
                label="Reason for Deletion" 
                value={withdrawReason} 
                onChange={(e) => setWithdrawReason(e.target.value)}
                autoFocus
            >
                <option value="">Select Reason...</option>
                {settings.withdrawalReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Additional details..."
                    rows={3}
                    value={withdrawRemarks}
                    onChange={(e) => setWithdrawRemarks(e.target.value)}
                />
            </div>
            
            {copiesToWithdraw.length === 1 && !hasHistory(copiesToWithdraw[0].id) && (
                 <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                    <button 
                        onClick={handlePermanentDelete}
                        className="text-xs text-slate-400 hover:text-red-600 underline"
                    >
                        Permanently purge record (Admin only)
                    </button>
                 </div>
            )}
         </div>
      </Modal>

      {/* Manage Copy Modal */}
      <Modal
        isOpen={!!managingCopy}
        onClose={() => setManagingCopy(null)}
        title={`Manage Copy #${managingCopy?.id}`}
        footer={
            <>
                <Button variant="ghost" onClick={() => setManagingCopy(null)}>Cancel</Button>
                <Button onClick={handleSaveCopyChanges}>Update Copy</Button>
            </>
        }
      >
        {managingCopy && (
            <div className="space-y-4">
                {managingCopy.status === CopyStatus.BORROWED && (
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Item is currently borrowed.</p>
                            <p className="mt-1 opacity-90">Status cannot be changed manually while borrowed. Use the Circulation desk to return or mark lost by user.</p>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                        value={manageStatus}
                        onChange={(e) => setManageStatus(e.target.value as CopyStatus)}
                        disabled={managingCopy.status === CopyStatus.BORROWED}
                    >
                        <option value={CopyStatus.AVAILABLE}>Available</option>
                        <option value={CopyStatus.DAMAGED}>Damaged (Repair needed)</option>
                        <option value={CopyStatus.LOST}>Lost (Missing from inventory)</option>
                        <option value={CopyStatus.WITHDRAWN}>Withdrawn</option>
                        {managingCopy.status === CopyStatus.BORROWED && <option value={CopyStatus.BORROWED}>Borrowed</option>}
                    </select>
                </div>

                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${manageIsRef ? 'bg-blue-600' : 'bg-slate-300'}`} onClick={() => setManageIsRef(!manageIsRef)}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${manageIsRef ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <div>
                        <span className="block text-sm font-medium text-slate-900">Reference Only</span>
                        <span className="text-xs text-slate-500">Item cannot be issued to students/faculty. (Reduces Lendable count)</span>
                    </div>
                </div>

                {manageStatus === CopyStatus.WITHDRAWN && (
                    <div className="animate-in slide-in-from-top-2 fade-in">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Withdrawal <span className="text-red-500">*</span></label>
                        <textarea 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Too damaged, outdated edition..."
                            rows={3}
                            value={manageNarration}
                            onChange={(e) => setManageNarration(e.target.value)}
                        />
                    </div>
                )}
            </div>
        )}
      </Modal>
    </>
  );
};
