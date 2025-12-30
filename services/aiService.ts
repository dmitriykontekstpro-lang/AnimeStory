import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "../types";
import { supabase } from './supabaseClient.ts';

// The user provided a key which is used here.
const NOVITA_API_KEY = 'sk_EM3dQx_2w7P64ag8AEQB-6MiBBpZNNdvvTXDmWk5UAg';
const NOVITA_API_URL = 'https://api.novita.ai/openai/v1/chat/completions';

const NOVITA_MODELS_TO_TRY = [
    'deepseek/deepseek-r1','deepseek/deepseek-v3','deepseek/deepseek-r1-turbo','deepseek/deepseek-v3-turbo','deepseek/deepseek-r1-distill-llama-70b','deepseek/deepseek-r1-distill-qwen-32b','meta-llama/llama-4-maverick-17b','meta-llama/llama-4-scout-17b','meta-llama/llama-3.3-70b-instruct','meta-llama/llama-3.1-405b-instruct','meta-llama/llama-3.1-70b-instruct','meta-llama/llama-3.1-8b-instruct','meta-llama/llama-3.1-8b-instruct-max','qwen/qwen3-235b-a22b-instruct','qwen/qwen3-32b-instruct','qwen/qwen3-30b-a3b-instruct','qwen/qwen-2.5-72b-instruct','qwen/qwen-2.5-7b-instruct','qwen/qwen2.5-vl-72b-instruct','nous-research/hermes-2-mixtral-8x7b-dpo','gryphe/mythomax-l2-13b','cognitivecomputations/dolphin-2.9-llama-3-8b','cognitivecomputations/dolphin-2.9.1-llama-3-70b','sophosympatheia/midnight-rose-70b','sao10k/l3-70b-euryale-v2.1','sao10k/l3-8b-lunaris','neverending-dream/noromaid-v0.4-mixtral-instruct-8x7b-zloss','mistralai/mistral-large-2','mistralai/mistral-nemo','mistralai/mixtral-8x22b-instruct','mistralai/mistral-7b-instruct-v0.3','google/gemma-3-27b-it','google/gemma-3-4b-it','moonshotai/kimi-k2-instruct','moonshotai/kimi-dev-72b','microsoft/phi-3.5-medium-instruct','01-ai/yi-1.5-34b-chat','cohere/command-r-plus','upstage/solar-10.7b-instruct','zai-org/glm-4.7',
];

async function callGeminiApi(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API-ключ для Gemini не найден в process.env.API_KEY.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.9,
        }
    });

    if (!response.text) {
        throw new Error("Gemini вернул пустой ответ.");
    }
    return response.text;
}

async function callNovitaAI(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!NOVITA_API_KEY) {
        throw new Error("Novita AI API key not found.");
    }

    for (const model of NOVITA_MODELS_TO_TRY) {
        try {
            console.log(`Attempting to use Novita AI model: ${model}`);
            const response = await fetch(NOVITA_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NOVITA_API_KEY}` },
                body: JSON.stringify({
                    model: model,
                    messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ],
                    max_tokens: 4096, temperature: 0.9, presence_penalty: 0.2,
                }),
            });

            if (response.status === 401) throw new Error("Неверный ключ API для Novita AI. Проверьте правильность ключа.");
            if (response.ok) {
                const data = await response.json();
                if (!data.choices?.[0]?.message?.content) throw new Error("Novita AI вернул некорректный ответ.");
                return data.choices[0].message.content;
            }

            const errorBody = await response.json().catch(() => ({ message: response.statusText }));
            if (response.status === 404 && errorBody.reason === 'MODEL_NOT_FOUND') continue;
            throw new Error(`API-ошибка Novita AI: ${response.status} - ${errorBody.message || 'Неизвестная ошибка'}`);
        } catch (error: any) {
            if (error.message.includes("Неверный ключ API")) throw error;
            console.error(`Request with model ${model} failed:`, error);
        }
    }
    throw new Error("Не удалось найти доступную модель на Novita AI после перебора всех вариантов.");
}

async function callApi(systemPrompt: string, userPrompt: string): Promise<{ result: string, provider: AIProvider }> {
    try {
        const result = await callGeminiApi(systemPrompt, userPrompt);
        return { result, provider: 'Gemini' };
    } catch (geminiError: any) {
        console.warn("Google Gemini failed. Falling back to Novita AI.", geminiError.message);
        try {
            const result = await callNovitaAI(systemPrompt, userPrompt);
            return { result, provider: 'Novita AI' };
        } catch (novitaError: any) {
            let errorMessage = novitaError.message;
            if (novitaError instanceof TypeError && novitaError.message.includes('Failed to fetch')) {
                 errorMessage = 'Ошибка сети (Failed to fetch). Это может быть связано с CORS-ограничениями, так как API Novita может не поддерживать прямые запросы из браузера.';
            }
            throw new Error(`Основной API (Gemini) не удался: ${geminiError.message}\n\nЗапасной API (Novita AI) также не удался: ${errorMessage}`);
        }
    }
}

const parseStoryForSupabase = (text: string) => {
    const parsedData: { [key: string]: string } = {};
    const delimiterRegex = /((?:Страница|Page)\s*(\d+)[,.\s]+(?:Блок|Block)\s*(\d+))/gi;
    const parts = text.split(delimiterRegex);

    for (let i = 1; i < parts.length; i += 4) {
        const marker = parts[i];
        const pageNum = parts[i + 1];
        const blockNum = parts[i + 2];
        const content = (parts[i + 3] || '').trim();
        
        if (pageNum && blockNum && content) {
            const key = `p${pageNum}_b${blockNum}`;
            parsedData[key] = content;
        }
    }
    return parsedData;
};

const parseDialogue = (text: string): { [key: string]: string } => {
    const dialogueData: { [key: string]: string } = {};
    const regex = /<start_(p\d+_b\d+)>([\s\S]*?)<end_\1>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const key = `${match[1]}_dialogue`; // e.g., p2_b1_dialogue
        const content = match[2].trim();
        if (content) {
          dialogueData[key] = content;
        }
    }
    return dialogueData;
};

export async function* generateStory(prompt: string): AsyncGenerator<{ 
    message: string; 
    story?: string; 
    provider?: AIProvider;
    plot?: string;
    dialogue?: string;
    storyId?: number;
    systemPrompts?: {
        plot?: string;
        story?: string;
        dialogue?: string;
    }
}> {
    // Stage 1: Plot Generation
    const plotSystem = `Ты — креативный писатель для историй в стиле хентай. Твоя задача — написать полный план сюжета на основе запроса пользователя. Ответ должен быть строго на русском языке.

Для каждого блока в структуре предоставь подробное предложение, описывающее действия персонажа, его чувства или происходящие с ним события.

Сюжет ДОЛЖЕН следовать этой точной структуре, где каждая строка представляет отдельный блок. Используй русские слова "Страница" и "Блок":
Страница 1, Блок 1
Страница 1, Блок 2
Страница 1, Блок 3
Страница 2, Блок 1
Страница 3, Блок 1
Страница 3, Блок 2
Страница 4, Блок 1
Страница 4, Блок 2
Страница 4, Блок 3
Страница 4, Блок 4
Страница 5, Блок 1
Страница 5, Блок 2
Страница 5, Блок 3
Страница 5, Блок 4
Страница 5, Блок 5
Страница 5, Блок 6
Страница 6, Блок 1
Страница 6, Блок 2
Страница 7, Блок 1
Страница 7, Блок 2
Страница 7, Блок 3
Страница 8, Блок 1
Страница 9, Блок 1
Страница 9, Блок 2

Запрос пользователя: "${prompt}"`;
    yield { message: "Создание сюжета истории...", systemPrompts: { plot: plotSystem } };
    const { result: plot } = await callApi(plotSystem, `Создай сюжет для запроса пользователя: "${prompt}"`);
    yield { message: "Сюжет создан.", plot };

    // Stage 2: Detailed Story Writing
    const storySystem = `Ты — мастер написания историй в стиле хентай. Твоя задача — превратить данный сюжет в полную, подробную и яркую историю.
История должна быть строго на русском языке и объемом примерно 3000 символов.
Сосредоточься на:
- **Подробных описаниях:** Опиши действия персонажей, физические ощущения, эмоции, физиологические реакции и внутренние мысли.
- **Чувственном языке:** Используй яркий язык, который взывает к чувствам.
- **Темпе повествования:** Правильно выстраивай напряжение и возбуждение.

Ты ДОЛЖЕН точно следовать предоставленному плану сюжета. Сохраняй структуру "Страница X, Блок Y" в своем ответе. Содержание каждого блока должно следовать сразу за соответствующим маркером.

Результат должен быть единым, непрерывным текстом.

Вот сюжет, которому ты должен следовать:
--- НАЧАЛО СЮЖЕТА ---
${plot}
--- КОНЕЦ СЮЖЕТА ---
`;
    yield { message: "Написание детальной истории по сюжету...", systemPrompts: { story: storySystem } };
    const { result: detailedStory, provider } = await callApi(storySystem, `Напиши полную историю на основе сюжета: ${plot}`);

    // Stage 3: Saving to Database
    yield { message: "История сгенерирована! Сохранение в базу данных...", story: detailedStory, provider };
    
    if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
    }

    const parsedBlocks = parseStoryForSupabase(detailedStory);
    const storyDataToSave = {
        user_prompt: prompt,
        plot_system_prompt: plotSystem.replace(`"${prompt}"`, '...'),
        story_system_prompt: storySystem.replace(plot, '...'),
        final_story_raw: detailedStory,
        provider: provider,
        ...parsedBlocks
    };

    const { data, error } = await supabase
        .from('stories')
        .insert([storyDataToSave])
        .select('id')
        .single();
    
    if (error) {
        console.error("Ошибка при сохранении в Supabase:", error);
        throw new Error(`Не удалось сохранить историю в базу данных: ${error.message}`);
    }

    if (!data) {
        throw new Error("Не удалось получить ID новой записи из Supabase.");
    }
    const storyId = data.id;

    // Stage 4: Dialogue Generation
    yield { message: "Генерация реплик персонажей...", storyId };

    const dialogueContextBlocks = Object.entries(parsedBlocks)
      .filter(([key]) => {
        const match = key.match(/^p(\d+)_b\d+$/);
        if (!match) return false;
        const pageNum = parseInt(match[1]);
        return pageNum % 2 === 0; // Filter for even pages
      })
      .map(([key, content]) => `<context_${key}>\n${content}\n</context_${key}>`)
      .join('\n\n');

    if (dialogueContextBlocks) {
        const dialogueSystemPrompt = `Ты — сценарист, специализирующийся на эмоциональных диалогах и внутренних монологах для хентай-историй. Твоя задача — написать по две реплики для каждого блока текста (контекста), предоставленного ниже.

Эти реплики должны быть не просто словами, а отражением самых глубоких чувств персонажей. Представь, что это их непроизвольные выкрики, стоны, шёпот или обрывки мыслей в момент сильного возбуждения. Наполни их страстью, желанием, болью, удовольствием и эмоциями.

Правила:
1.  Для каждого блока напиши ровно две реплики.
2.  Вместо "Реплика 1" и "Реплика 2" используй имена персонажей. Если имена не указаны в контексте, определи их сам (например, "Она:", "Он:", или придумай подходящие имена).
3.  Реплики должны быть короткими, экспрессивными и полными эмоций.
4.  Форматируй ответ СТРОГО следующим образом, используя маркеры для каждого блока:

<start_p{page}_b{block}>
Имя персонажа 1: "..."
Имя персонажа 2: "..."
<end_p{page}_b{block}>

Вот контекст из истории:
--- НАЧАЛО КОНТЕКСТА ---
${dialogueContextBlocks}
--- КОНЕЦ КОНТЕКСТА ---
`;
        yield { message: "Подготовка к генерации реплик...", systemPrompts: { dialogue: dialogueSystemPrompt } };
        // FIX: Corrected a typo in the variable name from 'dialogeSystemPrompt' to 'dialogueSystemPrompt'.
        const { result: generatedDialogue } = await callApi(dialogueSystemPrompt, "Сгенерируй диалоги согласно системным инструкциям.");
        yield { message: "Реплики сгенерированы.", dialogue: generatedDialogue };
        
        const dialogueUpdateData = parseDialogue(generatedDialogue);

        if (Object.keys(dialogueUpdateData).length > 0) {
            yield { message: "Сохранение реплик в базу данных...", storyId };
            const { error: updateError } = await supabase
                .from('stories')
                .update(dialogueUpdateData)
                .eq('id', storyId);

            if (updateError) {
                console.error("Ошибка при обновлении истории с репликами:", updateError);
                // Don't throw, just warn the user.
            }
        }
    }

    yield { message: "Готово!", storyId };
}