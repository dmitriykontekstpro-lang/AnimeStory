import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "../types";

// The user provided a key which is used here.
const NOVITA_API_KEY = 'sk_5PqNdMHarP9R8iT_jUPAhuJhz1khpOP8ugV2FA_Xt1U';
const NOVITA_API_URL = 'https://api.novita.ai/openai/v1/chat/completions';

// Updated and accurate list of Novita AI models provided by the user.
const NOVITA_MODELS_TO_TRY = [
    // ... (model list remains the same)
    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'deepseek/deepseek-r1-turbo',
    'deepseek/deepseek-v3-turbo',
    'deepseek/deepseek-r1-distill-llama-70b',
    'deepseek/deepseek-r1-distill-qwen-32b',
    'meta-llama/llama-4-maverick-17b',
    'meta-llama/llama-4-scout-17b',
    'meta-llama/llama-3.3-70b-instruct',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/llama-3.1-8b-instruct-max',
    'qwen/qwen3-235b-a22b-instruct',
    'qwen/qwen3-32b-instruct',
    'qwen/qwen3-30b-a3b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'qwen/qwen-2.5-7b-instruct',
    'qwen/qwen2.5-vl-72b-instruct',
    'nous-research/hermes-2-mixtral-8x7b-dpo',
    'gryphe/mythomax-l2-13b',
    'cognitivecomputations/dolphin-2.9-llama-3-8b',
    'cognitivecomputations/dolphin-2.9.1-llama-3-70b',
    'sophosympatheia/midnight-rose-70b',
    'sao10k/l3-70b-euryale-v2.1',
    'sao10k/l3-8b-lunaris',
    'neverending-dream/noromaid-v0.4-mixtral-instruct-8x7b-zloss',
    'mistralai/mistral-large-2',
    'mistralai/mistral-nemo',
    'mistralai/mixtral-8x22b-instruct',
    'mistralai/mistral-7b-instruct-v0.3',
    'google/gemma-3-27b-it',
    'google/gemma-3-4b-it',
    'moonshotai/kimi-k2-instruct',
    'moonshotai/kimi-dev-72b',
    'microsoft/phi-3.5-medium-instruct',
    '01-ai/yi-1.5-34b-chat',
    'cohere/command-r-plus',
    'upstage/solar-10.7b-instruct',
    'zai-org/glm-4.7',
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NOVITA_API_KEY}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: 4096,
                    temperature: 0.9,
                    presence_penalty: 0.2,
                }),
            });

            if (response.status === 401) {
                throw new Error("Неверный ключ API для Novita AI. Проверьте правильность ключа.");
            }

            if (response.ok) {
                console.log(`Successfully used Novita AI model: ${model}`);
                const data = await response.json();
                if (!data.choices?.[0]?.message?.content) {
                    throw new Error("Novita AI вернул некорректный ответ.");
                }
                return data.choices[0].message.content;
            }

            const errorBody = await response.json().catch(() => ({ message: response.statusText }));
            if (response.status === 404 && errorBody.reason === 'MODEL_NOT_FOUND') {
                console.warn(`Model not found: '${model}'. Trying next...`);
                continue;
            }
            
            throw new Error(`API-ошибка Novita AI: ${response.status} - ${errorBody.message || 'Неизвестная ошибка'}`);

        } catch (error: any) {
            if (error.message.includes("Неверный ключ API")) {
                throw error;
            }
            console.error(`Request with model ${model} failed:`, error);
        }
    }

    throw new Error("Не удалось найти доступную модель на Novita AI после перебора всех вариантов. Проверьте статус сервиса или ключ API.");
}

async function callApi(systemPrompt: string, userPrompt: string): Promise<{ result: string, provider: AIProvider }> {
    try {
        console.log("Attempting to use Google Gemini...");
        const result = await callGeminiApi(systemPrompt, userPrompt);
        console.log("Successfully used Google Gemini.");
        return { result, provider: 'Gemini' };
    } catch (geminiError: any) {
        console.warn("Google Gemini failed. Falling back to Novita AI.", geminiError.message);
        
        try {
            console.log("Attempting to use Novita AI as fallback...");
            const result = await callNovitaAI(systemPrompt, userPrompt);
            return { result, provider: 'Novita AI' };
        } catch (novitaError: any) {
            console.error("Novita AI also failed.", novitaError);
            let errorMessage = novitaError.message;
            if (novitaError instanceof TypeError && novitaError.message.includes('Failed to fetch')) {
                 errorMessage = 'Ошибка сети при обращении к Novita AI (Failed to fetch). Это может быть связано с CORS-ограничениями, так как API Novita может не поддерживать прямые запросы из браузера. Проверьте консоль для получения дополнительной информации.';
            }
            
            throw new Error(
                `Основной API (Gemini) не удался: ${geminiError.message}\n\nЗапасной API (Novita AI) также не удался: ${errorMessage}`
            );
        }
    }
}

export async function* generateStory(prompt: string): AsyncGenerator<{ 
    message: string; 
    story?: string; 
    provider?: AIProvider;
    plot?: string;
    systemPrompts?: {
        plot?: string;
        story?: string;
    }
}> {
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
    yield { 
        message: "Создание сюжета истории...",
        systemPrompts: { plot: plotSystem }
    };
    const { result: plot } = await callApi(plotSystem, `Создай сюжет для запроса пользователя.`);
    yield { message: "Сюжет создан.", plot };

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
    yield { 
        message: "Написание детальной истории по сюжету...",
        systemPrompts: { story: storySystem }
    };
    const { result: detailedStory, provider } = await callApi(storySystem, "Теперь напиши полную историю на основе сюжета, предоставленного в системных инструкциях.");

    yield { message: "История сгенерирована!", story: detailedStory, provider };
}