import React, { useState, useCallback, useEffect } from 'react';
import { PromptInput } from './components/PromptInput.tsx';
import { TextViewer } from './components/TextViewer.tsx';
import { Loader } from './components/Loader.tsx';
import { GenerationLog } from './components/GenerationLog.tsx';
import { MangaViewer } from './components/MangaViewer.tsx';
import { generateStory } from './services/aiService.ts';
import { fetchStoryList } from './services/supabaseClient.ts';
import type { AIProvider } from './types';

type Tab = 'text' | 'manga';

interface StoryListItem {
  id: number;
  user_prompt: string;
  created_at: string;
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [storyId, setStoryId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [usedProvider, setUsedProvider] = useState<AIProvider | null>(null);
  const [plot, setPlot] = useState<string | null>(null);
  const [generatedDialogue, setGeneratedDialogue] = useState<string | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<any>({});
  
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [stories, setStories] = useState<StoryListItem[]>([]);

  useEffect(() => {
    const loadStories = async () => {
        try {
            const storyList = await fetchStoryList();
            setStories(storyList || []);
        } catch (err: any) {
            console.error("Failed to load story list:", err);
            setError("Не удалось загрузить список сохраненных историй.");
        }
    };
    loadStories();
  }, []);

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
    setGeneratedDialogue(null);
    setStoryId(null);
    setSystemPrompts({});
    setActiveTab('text');
    try {
      const storyGenerator = generateStory(prompt);
      for await (const update of storyGenerator) {
        setLoadingMessage(update.message);
        if (update.systemPrompts) {
          setSystemPrompts((prev: any) => ({ ...prev, ...update.systemPrompts }));
        }
        if (update.plot) setPlot(update.plot);
        if (update.dialogue) setGeneratedDialogue(update.dialogue);
        if (update.story) {
          setGeneratedStory(update.story);
          setUsedProvider(update.provider || null);
        }
        if (update.storyId) {
          setStoryId(update.storyId);
          // Refresh story list after successful generation
          const storyList = await fetchStoryList();
          setStories(storyList || []);
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

  const handleSelectStory = (id: number) => {
    setStoryId(id);
    setGeneratedStory(null);
    setPlot(null);
    setGeneratedDialogue(null);
    setError(null);
    setActiveTab('text');
  };

  const header = (
    <header className="w-full text-center p-4 border-b border-slate-700 shadow-lg bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        Генератор NSFW Хентай-Историй
      </h1>
      <p className="text-sm text-slate-400 mt-1">Создавайте пикантные истории в стиле хентай</p>
    </header>
  );
  
  const TabButton: React.FC<{tab: Tab, label: string, disabled?: boolean}> = ({ tab, label, disabled }) => (
    <button
      onClick={() => !disabled && setActiveTab(tab)}
      disabled={disabled}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tab 
          ? 'bg-purple-600 text-white' 
          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
  
  const SavedStoriesList = () => (
     <div className="mt-8 w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700">
        <h3 className="text-lg font-bold text-slate-300 mb-4">Сохраненные Истории</h3>
        {stories.length > 0 ? (
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {stories.map(story => (
                    <li key={story.id}>
                        <button 
                            onClick={() => handleSelectStory(story.id)}
                            className="w-full text-left p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg transition-colors duration-200"
                        >
                            <p className="font-semibold text-purple-400 truncate">{story.user_prompt || "Без промпта"}</p>
                            <p className="text-xs text-slate-500">{new Date(story.created_at).toLocaleString('ru-RU')}</p>
                        </button>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-slate-500 text-sm">Здесь будут отображаться ваши сгенерированные истории.</p>
        )}
    </div>
  );

  const renderGeneratorContent = () => (
    <>
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
      <SavedStoriesList />
      {isLoading && <Loader message={loadingMessage} />}
      {storyId && !isLoading && (
        <>
          <GenerationLog 
            plot={plot}
            detailedStory={generatedStory}
            generatedDialogue={generatedDialogue}
            systemPrompts={systemPrompts}
          />
          <TextViewer storyId={storyId} provider={usedProvider} />
        </>
      )}
      {!isLoading && !storyId && (
        <div className="mt-8 text-center text-slate-500">
          <p>Введите ваш промт на русском языке и нажмите "Сгенерировать", чтобы начать, или выберите историю из списка ниже.</p>
          <p className="text-xs mt-2">Пожалуйста, помните, что генерируемый контент предназначен для взрослой аудитории.</p>
        </div>
      )}
    </>
  );

  const renderMainContent = () => (
    <>
      {header}
      <main className={`flex-grow w-full mx-auto p-4 md:p-8 flex flex-col items-center transition-all duration-300 ${activeTab === 'manga' && storyId ? 'max-w-screen-2xl' : 'max-w-4xl'}`}>
        {storyId && !isLoading && (
          <div className="w-full flex justify-center gap-4 mb-6">
            <TabButton tab="text" label="Текст" />
            <TabButton tab="manga" label="Манга" disabled={!storyId} />
          </div>
        )}
        
        {(!storyId || activeTab === 'text') && renderGeneratorContent()}
        {activeTab === 'manga' && storyId && <MangaViewer storyId={storyId} />}
      </main>
      <footer className="w-full text-center p-4 text-xs text-slate-600 border-t border-slate-800">
        <p>AI-powered story generation. Content is fictional and for entertainment purposes only.</p>
      </footer>
    </>
  );

  return (
    <div className="flex flex-col h-full font-sans text-slate-200 bg-slate-900 overflow-y-auto">
      {renderMainContent()}
    </div>
  );
};

export default App;