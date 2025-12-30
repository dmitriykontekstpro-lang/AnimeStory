import React, { useState } from 'react';
import { saveSupabaseCredentials, getSupabaseCredentials } from '../services/supabaseClient.ts';

interface SupabaseSetupProps {
  onCredentialsSet: () => void;
}

export const SupabaseSetup: React.FC<SupabaseSetupProps> = ({ onCredentialsSet }) => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
  const [url, setUrl] = useState(supabaseUrl || '');
  const [anonKey, setAnonKey] = useState(supabaseAnonKey || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!url.trim() || !url.startsWith('http')) {
      setError('Пожалуйста, введите корректный Supabase URL (должен начинаться с http).');
      return;
    }
    if (!anonKey.trim()) {
      setError('Пожалуйста, введите ваш Supabase Anon Key.');
      return;
    }
    setError('');
    saveSupabaseCredentials(url, anonKey);
    onCredentialsSet();
  };

  return (
    <div className="w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in text-slate-300">
      <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
        Настройка подключения к Supabase
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Для сохранения и загрузки историй приложению требуется доступ к вашей базе данных Supabase. Пожалуйста, введите URL проекта и публичный `anon` ключ.
      </p>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="supabase-url" className="block text-sm font-medium mb-1">Supabase Project URL</label>
          <input
            id="supabase-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxx.supabase.co"
            className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label htmlFor="supabase-key" className="block text-sm font-medium mb-1">Supabase Anon Key (Public)</label>
          <input
            id="supabase-key"
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJHbGciOiJIUzI1NiI9.eyJ..."
            className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6">
        <button
          onClick={handleSave}
          className="w-full px-6 py-2 font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Сохранить и продолжить
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500 text-center">
        Эту информацию можно найти в настройках вашего проекта Supabase: Project Settings &gt; API.
      </p>
    </div>
  );
};
