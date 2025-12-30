import { createClient } from '@supabase/supabase-js';

// Fix: Implement credential management to resolve missing exports for SupabaseSetup.tsx.
const SUPABASE_URL_KEY = 'supabaseUrl';
const SUPABASE_ANON_KEY = 'supabaseAnonKey';

/**
 * Saves Supabase credentials to localStorage and reloads the page to apply them.
 * @param url The Supabase project URL.
 * @param anonKey The Supabase public anon key.
 */
export const saveSupabaseCredentials = (url: string, anonKey: string): void => {
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_ANON_KEY, anonKey);
  window.location.reload();
};

/**
 * Retrieves Supabase credentials from localStorage.
 * @returns An object with the Supabase URL and anon key, or null if not set.
 */
export const getSupabaseCredentials = (): { supabaseUrl: string | null; supabaseAnonKey: string | null } => {
  return {
    supabaseUrl: localStorage.getItem(SUPABASE_URL_KEY),
    supabaseAnonKey: localStorage.getItem(SUPABASE_ANON_KEY),
  };
};

const credentials = getSupabaseCredentials();

const supabaseUrl = credentials.supabaseUrl || 'https://hnlogmabzhsrxfgdwopi.supabase.co';
const supabaseAnonKey = credentials.supabaseAnonKey || 'sb_publishable_gyskDSuO1Xj7NLbFN944lw_cQDJFwvv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches a single story from the Supabase database by its ID.
 * @param id The unique identifier of the story to fetch.
 * @returns A promise that resolves to the story data or null if not found.
 */
export const fetchStory = async (id: number) => {
    if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
    }

    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Ошибка при загрузке истории из Supabase:', error);
        throw new Error(`Не удалось загрузить историю: ${error.message}`);
    }

    return data;
};
