
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

export const Badge: React.FC<{ color: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'; children: React.ReactNode }> = ({ color, children }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ variant = 'primary', className = '', ...props }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }> = ({ label, error, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
    <input
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-all ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-500' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'} ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} /> {error}</p>}
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }> = ({ label, error, className = '', children, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
    <select
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-all bg-white ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-500' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'} ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} /> {error}</p>}
  </div>
);

export const MultiSelect: React.FC<{
  label?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
}> = ({ label, options, value, onChange, placeholder = "Select...", error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const removeValue = (v: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(val => val !== v));
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <div 
        className={`w-full min-h-[38px] px-3 py-1.5 border rounded-lg bg-white cursor-pointer flex flex-wrap gap-1 items-center ${error ? 'border-red-300 focus-within:ring-2 focus-within:ring-red-200' : 'border-slate-300'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {value.length === 0 && <span className="text-slate-400 text-sm">{placeholder}</span>}
        {value.map(v => (
          <span key={v} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs flex items-center gap-1">
            {v}
            <button onClick={(e) => removeValue(v, e)} className="hover:text-blue-900"><X size={12} /></button>
          </span>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} /> {error}</p>}

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-slate-500 text-sm text-center">No options available</div>
          ) : (
            options.map(option => (
              <div 
                key={option} 
                className={`px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer flex justify-between items-center ${value.includes(option) ? 'bg-slate-50 text-blue-600 font-medium' : 'text-slate-700'}`}
                onClick={() => toggleOption(option)}
              >
                {option}
                {value.includes(option) && <Check size={14} />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-slate-600 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
