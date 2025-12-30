// This key is for Novita AI, a different service from the one used for text.
const NOVITA_API_KEY = 'sk_EM3dQx_2w7P64ag8AEQB-6MiBBpZNNdvvTXDmWk5UAg';
const NOVITA_TXT2IMG_URL = 'https://api.novita.ai/v3/text-to-image';

// A list of high-quality anime/manga models to try in sequence.
const NOVITA_IMAGE_MODELS_TO_TRY = [
    'ponydiffusionv6xl_v615.safetensors',
    'realisticVisionV51_v51VAE.safetensors',
    'chilloutmix_NiPrunedFp32Fix.safetensors',
    'dreamshaper_8.safetensors',
    'meinamix_v11.safetensors',
    'AnythingV5_v5PrtRE.safetensors',
    'AbsoluteReality_v181.safetensors',
];

export async function generateMangaImage(sceneDescription: string): Promise<string> {
    if (!NOVITA_API_KEY) {
        throw new Error("API-ключ для Novita AI не найден.");
    }

    // Construct a detailed prompt using the provided scene description as the subject.
    const prompt = `masterpiece, best quality, highly detailed manga page panel, intense dramatic scene, traditional ink drawing style, monochromatic with selective color accents, vivid crimson red, deep black ink, rough sketch lines, G-pen texture, analog feel, heavy screentones, cross-hatching shading, high contrast lighting, noir atmosphere, nsfw. SUBJECT: ${sceneDescription}. DETAILS: expressive faces, motion blur effects, Japanese sound effect text (SFX), rough paper texture border. STYLISTIC REFERENCES: Fullmetal Alchemist manga style, Demon Slayer art style, detailed line work, raw and gritty, cinematic angle, dynamic composition, sharp focus, 8k resolution.`;
    const negative_prompt = "(worst quality, low quality, normal quality), color, 3d, photo, realistic, ugly, deformed, text, watermark, signature, blurry, jpeg artifacts, child, loli, signature, artist name, text, watermark";

    for (const model_name of NOVITA_IMAGE_MODELS_TO_TRY) {
        console.log(`Попытка генерации изображения с моделью: ${model_name}`);
        
        const requestBody = {
            model_name,
            prompt,
            negative_prompt,
            width: 684, // Aspect ratio 2:3
            height: 1024,
            sampler_name: "DPM++ 2M Karras",
            steps: 30, // Increased for potentially better detail
            cfg_scale: 7,
            sd_vae: "auto",
        };

        try {
            const response = await fetch(NOVITA_TXT2IMG_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NOVITA_API_KEY}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (response.status === 401) {
                throw new Error("Неверный ключ API для Novita AI. Проверьте правильность ключа и попробуйте снова.");
            }

            if (response.ok) {
                const data = await response.json();
                const base64Image = data?.images?.[0]?.image_b64;

                if (base64Image) {
                    console.log(`Изображение успешно сгенерировано с помощью ${model_name}.`);
                    return `data:image/png;base64,${base64Image}`;
                } else {
                    console.warn(`Модель ${model_name} вернула ответ без изображения.`, data);
                    // Continue to the next model
                }
            } else {
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                console.error(`Ошибка от Novita AI с моделью ${model_name}: ${response.status} - ${errorBody.message || 'Неизвестная ошибка'}`);
                // Continue to the next model, as this one failed.
            }
        } catch (error: any) {
            console.error(`Сетевая ошибка или проблема с запросом для модели ${model_name}:`, error);
            // Continue to the next model on network errors
        }
    }

    throw new Error("Не удалось сгенерировать изображение. Ни одна из моделей Novita AI не ответила успешно.");
}