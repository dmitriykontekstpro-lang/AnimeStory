import { createClient } from '@supabase/supabase-js';

// NOTE: These are public demo credentials. 
// For your own project, please replace them with your Supabase project credentials.
// You can find them in your Supabase project settings under Project Settings > API.
const supabaseUrl = 'https://hnlogmabzhsrxfgdwopi.supabase.co';
const supabaseAnonKey = 'sb_publishable_gyskDSuO1Xj7NLbFN944lw_cQDJFwvv';


// Initialize the client directly. The placeholder check is no longer needed.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


/**
 * Fetches a single story from the Supabase database by its ID.
 * @param id The unique identifier of the story to fetch.
 * @returns A promise that resolves to the story data or null if not found.
 */
export const fetchStory = async (id: number) => {
    if (!supabase) {
        // This case is highly unlikely now but kept for safety.
        throw new Error('Клиент Supabase не удалось инициализировать.');
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

/**
 * Fetches a list of stories from the Supabase database for display.
 * @returns A promise that resolves to an array of stories.
 */
export const fetchStoryList = async () => {
    if (!supabase) {
        throw new Error('Клиент Supabase не удалось инициализировать.');
    }

    const { data, error } = await supabase
        .from('stories')
        .select('id, user_prompt, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Ошибка при загрузке списка историй из Supabase:', error);
        throw new Error(`Не удалось загрузить список историй: ${error.message}`);
    }

    return data;
};