import React, { useState, useCallback } from 'react';
import { PromptInput } from './components/PromptInput.tsx';
import { StoryDisplay } from './components/StoryDisplay.tsx';
import { Loader } from './components/Loader.tsx';
import { GenerationLog } from './components/GenerationLog.tsx';
import { generateStory } from './services/aiService.ts';
import type { AIProvider } from './types';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [usedProvider, setUsedProvider] = useState<AIProvider | null>(null);

  // State for generation log
  const [plot, setPlot] = useState<string | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<any>({});


  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Пожалуйста, введите промт.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedStory(null);
    setUsedProvider(null);
    setPlot(null);
    setSystemPrompts({});

    try {
      const storyGenerator = generateStory(prompt);
      for await (const update of storyGenerator) {
        setLoadingMessage(update.message);

        if (update.systemPrompts) {
          setSystemPrompts((prev: any) => ({ ...prev, ...update.systemPrompts }));
        }
        if (update.plot) setPlot(update.plot);
        if (update.story) {
          setGeneratedStory(update.story);
          setUsedProvider(update.provider || null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла неизвестная ошибка.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [prompt]);

  return (
    <div className="flex flex-col h-full font-sans text-slate-200 bg-slate-900 overflow-y-auto">
      <header className="w-full text-center p-4 border-b border-slate-700 shadow-lg bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          Генератор NSFW Хентай-Историй
        </h1>
        <p className="text-sm text-slate-400 mt-1">Создавайте пикантные истории в стиле хентай</p>
      </header>
      
      <main className="flex-grow w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col items-center">
        <div className="w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700">
          <PromptInput 
            prompt={prompt} 
            setPrompt={setPrompt} 
            onGenerate={handleGenerate} 
            isLoading={isLoading} 
          />

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-left">
              <p className="font-bold mb-2">Ошибка:</p>
              <p className="whitespace-pre-wrap text-sm">{error}</p>
            </div>
          )}
        </div>

        {isLoading && <Loader message={loadingMessage} />}

        {generatedStory && !isLoading && (
          <>
            <GenerationLog 
              plot={plot}
              detailedStory={generatedStory}
              systemPrompts={systemPrompts}
            />
            <StoryDisplay story={generatedStory} provider={usedProvider} />
          </>
        )}

        {!isLoading && !generatedStory && (
            <div className="mt-8 text-center text-slate-500">
                <p>Введите ваш промт на русском языке и нажмите "Сгенерировать", чтобы начать.</p>
                <p className="text-xs mt-2">Пожалуйста, помните, что генерируемый контент предназначен для взрослой аудитории. Результаты могут отличаться.</p>
            </div>
        )}
      </main>

      <footer className="w-full text-center p-4 text-xs text-slate-600 border-t border-slate-800">
        <p>AI-powered story generation. Content is fictional and for entertainment purposes only.</p>
      </footer>
    </div>
  );
};

export default App;
