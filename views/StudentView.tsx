
import React, { useState, useEffect, useMemo } from 'react';
import { SystemUser, Book, Copy, CopyStatus } from '../types';
import { db } from '../services/storage';
import { Search, Library, LogOut, Key, MapPin, BookOpen, Layers, Loader2, X } from 'lucide-react';
import { Card, Button, Badge, Modal, Input } from '../components/Shared';

interface StudentViewProps {
  currentUser: SystemUser;
  onLogout: () => void;
  onChangePassword: () => void;
  onNotify: (msg: string, type: 'success' | 'error') => void;
}

export const StudentView: React.FC<StudentViewProps> = ({ currentUser, onLogout, onChangePassword, onNotify }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedBooks, fetchedCopies] = await Promise.all([
                db.getBooks(),
                db.getCopies()
            ]);
            setBooks(fetchedBooks);
            setCopies(fetchedCopies);
        } catch (e) {
            onNotify("Failed to load library catalog", "error");
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  const getAvailableCount = (bookId: string) => {
    return copies.filter(c => c.bookId === bookId && c.status === CopyStatus.AVAILABLE && !c.isReferenceOnly).length;
  };

  const getTotalCount = (bookId: string) => {
    return copies.filter(c => c.bookId === bookId && c.status !== CopyStatus.WITHDRAWN && c.status !== CopyStatus.LOST).length;
  };

  const filteredBooks = useMemo(() => {
      if (!searchTerm) return books;
      const s = searchTerm.toLowerCase();
      return books.filter(b => 
          b.title.toLowerCase().includes(s) ||
          b.authors.some(a => a.toLowerCase().includes(s)) ||
          b.isbn.includes(s) ||
          b.publisher.toLowerCase().includes(s) ||
          b.categories.some(c => c.toLowerCase().includes(s))
      );
  }, [books, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <Library size={20} />
                </div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Instuto</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-slate-800">{currentUser.name}</p>
                    <p className="text-xs text-slate-500">Student Account</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onChangePassword}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors"
                        title="Change Password"
                    >
                        <Key size={18} />
                    </button>
                    <button 
                        onClick={onLogout}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-full transition-colors"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search Hero */}
        <div className="text-center mb-10 space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Find your next read</h2>
            <div className="max-w-2xl mx-auto relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input 
                    type="text"
                    className="w-full pl-12 pr-4 py-3 rounded-full border border-slate-300 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-lg shadow-sm transition-all outline-none"
                    placeholder="Search by Title, Author, ISBN, or Publisher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
            <p className="text-sm text-slate-500">
                Searching {filteredBooks.length} books in the catalog
            </p>
        </div>

        {/* Results Grid */}
        {loading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        ) : (
            <>
                {filteredBooks.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">No books found</h3>
                        <p className="text-slate-500">Try adjusting your search terms.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredBooks.map(book => {
                            const avail = getAvailableCount(book.id);
                            return (
                                <Card 
                                    key={book.id} 
                                    className="p-0 hover:shadow-md transition-shadow cursor-pointer border-slate-200 overflow-hidden flex flex-col h-full group"
                                    onClick={() => setSelectedBook(book)}
                                >
                                    <div className="h-2 bg-blue-500 w-full shrink-0 group-hover:h-3 transition-all"></div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge color="blue">{book.categories[0]}</Badge>
                                            <span className="font-mono text-xs text-slate-400">{book.locCallNumber}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-2">{book.title}</h3>
                                        <p className="text-slate-600 text-sm mb-4">{book.authors.join(', ')}</p>
                                        
                                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <Layers size={14} /> {book.locationRack} / {book.locationShelf}
                                            </span>
                                            {avail > 0 ? (
                                                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full text-xs">
                                                    {avail} Available
                                                </span>
                                            ) : (
                                                <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full text-xs">
                                                    Out of Stock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </>
        )}
      </main>

      {/* Book Detail Modal */}
      <Modal
        isOpen={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        title="Book Details"
      >
        {selectedBook && (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedBook.title}</h2>
                    <p className="text-lg text-slate-600 mt-1">{selectedBook.authors.join(', ')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                    <div>
                        <p className="text-slate-500 mb-0.5">Publisher</p>
                        <p className="font-medium">{selectedBook.publisher} ({selectedBook.publishedYear})</p>
                    </div>
                    <div>
                        <p className="text-slate-500 mb-0.5">ISBN</p>
                        <p className="font-mono font-medium">{selectedBook.isbn}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 mb-0.5">Genre</p>
                        <p className="font-medium">{selectedBook.genre}</p>
                    </div>
                     <div>
                        <p className="text-slate-500 mb-0.5">Call Number</p>
                        <p className="font-mono font-medium bg-white inline-block px-1 rounded border border-slate-200">{selectedBook.locCallNumber}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 border border-blue-100 bg-blue-50/50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-0.5">Location</p>
                        <p className="text-slate-900 font-medium">Rack {selectedBook.locationRack}, Shelf {selectedBook.locationShelf}</p>
                    </div>
                </div>

                {selectedBook.description && (
                    <div>
                        <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">{selectedBook.description}</p>
                    </div>
                )}

                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                     <span className="text-sm text-slate-500">Total Copies: {getTotalCount(selectedBook.id)}</span>
                     {getAvailableCount(selectedBook.id) > 0 ? (
                        <Button className="cursor-default bg-green-600 hover:bg-green-700 pointer-events-none">
                            Available Now
                        </Button>
                     ) : (
                        <Button variant="secondary" className="cursor-default pointer-events-none opacity-70">
                            Currently Unavailable
                        </Button>
                     )}
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
