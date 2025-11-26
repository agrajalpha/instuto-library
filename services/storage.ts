
import { Book, Copy, CopyStatus, SystemSettings, Transaction, TransactionStatus, User, Log, SystemUser } from "../types";

// With Vite proxying enabled, we can simply target the relative path '/api'.
// Vite will forward these requests to http://localhost:3000/api
const API_URL = '/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
        const url = `${API_URL}${endpoint}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `API Error: ${response.statusText} (${response.status})`);
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    } catch (e: any) {
        console.error(`Request Failed [${endpoint}] to ${API_URL}:`, e);
        throw e;
    }
  }

  // --- Auth ---
  async authenticate(email: string, password: string): Promise<SystemUser> {
    return this.request<SystemUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async changeUserPassword(id: string, newPass: string): Promise<void> {
    await this.request(`/system-users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPass }),
    });
  }

  // --- Settings ---
  async getSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>('/settings');
  }

  async updateSettings(settings: SystemSettings): Promise<void> {
    await this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async renameSettingValue(key: keyof SystemSettings, oldValue: string, newValue: string): Promise<boolean> {
    try {
        await this.request('/settings/rename', {
            method: 'POST',
            body: JSON.stringify({ key, oldValue, newValue })
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
  }

  // --- Books ---
  async getBooks(): Promise<Book[]> {
    return this.request<Book[]>('/books');
  }

  async saveBook(book: Book): Promise<Book> {
    return this.request<Book>('/books', {
      method: 'POST',
      body: JSON.stringify(book),
    });
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.request(`/books/${bookId}`, {
      method: 'DELETE',
    });
  }

  // --- Copies ---
  async getCopies(bookId?: string): Promise<Copy[]> {
    const query = bookId ? `?bookId=${bookId}` : '';
    return this.request<Copy[]>(`/copies${query}`);
  }

  async saveCopy(copy: Copy): Promise<Copy> {
    return this.request<Copy>('/copies', {
      method: 'POST',
      body: JSON.stringify(copy),
    });
  }

  async deleteCopy(copyId: string): Promise<void> {
    await this.request(`/copies/${copyId}`, {
      method: 'DELETE',
    });
  }

  // --- Users (Borrowers) ---
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async saveUser(user: User): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  // --- System Users (Staff) ---
  async getSystemUsers(): Promise<SystemUser[]> {
    return this.request<SystemUser[]>('/system-users');
  }

  async saveSystemUser(user: SystemUser): Promise<SystemUser> {
    return this.request<SystemUser>('/system-users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async deleteSystemUser(id: string): Promise<void> {
    await this.request(`/system-users/${id}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(id: string): Promise<void> {
    await this.request(`/system-users/${id}/reset-password`, { method: 'POST' });
  }

  async toggleUserStatus(id: string): Promise<void> {
    await this.request(`/system-users/${id}/toggle-status`, { method: 'POST' });
  }

  // --- Transactions ---
  async getTransactions(): Promise<Transaction[]> {
    return this.request<Transaction[]>('/transactions');
  }

  async createTransaction(t: Transaction): Promise<Transaction> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(t),
    });
  }

  async completeTransaction(t: Transaction, copyStatus: CopyStatus): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${t.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ ...t, finalCopyStatus: copyStatus }),
    });
  }

  async updateTransaction(t: Transaction): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify(t),
    });
  }

  // --- Logs ---
  async getLogs(bookId?: string): Promise<Log[]> {
    const query = bookId ? `?bookId=${bookId}` : '';
    return this.request<Log[]>(`/logs${query}`);
  }

  async addLog(log: Log): Promise<Log> {
    return this.request<Log>('/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }
}

export const db = new ApiService();
