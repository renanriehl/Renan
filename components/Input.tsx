import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        className={`px-4 py-2 bg-white text-slate-900 placeholder:text-slate-400 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
          error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};