import React, { useState, useEffect } from 'react';
import type { AIProvider } from '../types';
import { fetchStory } from '../services/supabaseClient.ts';

interface StoryDisplayProps {
  storyId: number;
  provider: AIProvider | null;
}

interface StoryBlock {
    block: string;
    content: string;
    dialogue?: string;
}

interface StoryPage {
    page: string;
    blocks: StoryBlock[];
}

const formatStoryFromData = (data: any): StoryPage[] => {
    if (!data) return [];
    
    const pagesMap = new Map<string, StoryPage>();

    // First pass for content blocks
    for (const key in data) {
        const match = key.match(/^p(\d+)_b(\d+)$/);
        if (match) {
            const pageNum = match[1];
            const blockNum = parseInt(match[2]);
            const content = data[key];

            if (content) {
                if (!pagesMap.has(pageNum)) {
                    pagesMap.set(pageNum, {
                        page: `Страница ${pageNum}`,
                        blocks: []
                    });
                }
                const page = pagesMap.get(pageNum)!;
                // Ensure the block object exists
                if (!page.blocks[blockNum - 1]) {
                    page.blocks[blockNum - 1] = { block: `Блок ${blockNum}`, content: '' };
                }
                page.blocks[blockNum - 1].content = content;
            }
        }
    }

    // Second pass for dialogue
    for (const key in data) {
        const match = key.match(/^p(\d+)_b(\d+)_dialogue$/);
        if (match) {
            const pageNum = match[1];
            const blockNum = parseInt(match[2]);
            const dialogueContent = data[key];
            const page = pagesMap.get(pageNum);

            if (page && page.blocks[blockNum - 1] && dialogueContent) {
                page.blocks[blockNum - 1].dialogue = dialogueContent;
            }
        }
    }
    
    // Clean up any empty slots and sort
    pagesMap.forEach(page => {
        page.blocks = page.blocks.filter(Boolean);
    });

    return Array.from(pagesMap.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(entry => entry[1]);
};


export const StoryDisplay: React.FC<StoryDisplayProps> = ({ storyId, provider }) => {
  const [storyData, setStoryData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) return;

    const loadStory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchStory(storyId);
        setStoryData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadStory();
  }, [storyId]);
  
  if (isLoading) {
    return (
        <div className="mt-8 w-full text-center text-slate-400">
            <p>Загрузка истории из базы данных...</p>
        </div>
    );
  }

  if (error) {
      return (
          <div className="mt-8 w-full p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">
              <p className="font-bold">Ошибка загрузки:</p>
              <p>{error}</p>
          </div>
      );
  }

  const parsedStory = formatStoryFromData(storyData);

  return (
    <div className="mt-8 w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-600">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          Финальный Результат: Ваша История #{storyId}
        </h2>
        {provider && (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-300">
            Сгенерировано с помощью: {provider}
          </span>
        )}
      </div>
      
      <div className="prose prose-invert prose-slate max-w-none text-slate-300 space-y-6">
        {parsedStory.map((page, pageIndex) => (
          <div key={pageIndex} className="p-4 border-l-4 border-purple-500/50 bg-slate-900/30 rounded-r-lg">
            <h3 className="text-lg font-semibold text-pink-400 mb-2">{page.page}</h3>
            {page.blocks.map((block, blockIndex) => (
              <div key={blockIndex} className="mb-4 last:mb-0">
                <h4 className="font-bold text-slate-400">{block.block}</h4>
                <p className="whitespace-pre-wrap">{block.content}</p>
                {block.dialogue && (
                   <blockquote className="mt-3 pl-4 border-l-2 border-pink-500/50 italic text-slate-400">
                     <pre className="whitespace-pre-wrap font-sans">{block.dialogue}</pre>
                   </blockquote>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};