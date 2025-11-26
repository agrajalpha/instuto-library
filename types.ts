

export enum UserRole {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  MANAGEMENT = 'MANAGEMENT',
}

export enum SystemRole {
  ADMIN = 'ADMIN',
  LIBRARIAN = 'LIBRARIAN',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  name: string;
  role: string; 
  email?: string; 
}

export interface SystemUser {
  id: string;
  name: string;
  role: SystemRole;
  email: string;
  password?: string; // Stored in plain/base64 for this demo
  isActive: boolean;
  lastLogin?: string;
}

export enum CopyStatus {
  AVAILABLE = 'AVAILABLE',
  BORROWED = 'BORROWED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
  WITHDRAWN = 'WITHDRAWN', 
}

export interface Copy {
  id: string; 
  bookId: string;
  status: CopyStatus;
  addedDate: string;
  narration?: string; 
  isReferenceOnly?: boolean; 
}

export interface Book {
  id: string;
  title: string;
  authors: string[]; 
  categories: string[]; 
  isbn: string;
  genre: string;
  publisher: string;
  publishedYear: string;
  locationRack: string;
  locationShelf: string;
  locCallNumber: string; 
  description?: string;
  coverUrl?: string;
}

export enum TransactionStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
}

export enum ReturnCondition {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export interface Transaction {
  id: string;
  copyId: string;
  bookId: string; 
  userId: string;
  userName: string; 
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: TransactionStatus;
  returnCondition?: ReturnCondition;
  fineAmount?: number;
}

export interface Log {
  id: string;
  bookId?: string; // Made optional to support system-level logs if needed
  bookTitle?: string;
  action: string; 
  description: string;
  timestamp: string;
  // The borrower/student involved (if any)
  userId?: string; 
  userName?: string;
  // The staff member who performed the action
  staffId?: string;
  staffName?: string;
}

export interface LenderType {
  name: string;
  duration: number; 
}

export interface ReturnFilterOption {
  label: string;
  days: number;
}

export interface SystemSettings {
  authors: string[];
  categories: string[];
  genres: string[];
  publishers: string[];
  racks: string[];
  shelves: string[];
  withdrawalReasons: string[];
  lenderTypes: LenderType[]; 
  returnFilterOptions: ReturnFilterOption[];
}

export type ViewState = 'DASHBOARD' | 'BOOKS' | 'CIRCULATION' | 'USERS' | 'SETTINGS' | 'LOGS';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}