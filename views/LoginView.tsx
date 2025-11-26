import React, { useState } from 'react';
import { db } from '../services/storage';
import { SystemUser } from '../types';
import { Button, Card } from '../components/Shared';
import { Library, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface LoginViewProps {
  onLogin: (user: SystemUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
        setError("Please enter both email and password.");
        return;
    }

    setLoading(true);
    try {
        const user = await db.authenticate(email, password);
        onLogin(user);
    } catch (err: any) {
        console.error(err);
        setError("Authentication failed. Please check your credentials.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-blue-600">
            <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                    <Library size={28} />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Instuto</h1>
                <p className="text-slate-500">Sign in to your staff account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                        <input 
                            type="email" 
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@instuto.edu"
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                        <input 
                            type="password" 
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                        />
                    </div>
                </div>

                <Button type="submit" className="w-full py-2.5 mt-2" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
                <p>Protected System. Authorized Access Only.</p>
            </div>
        </Card>
    </div>
  );
};