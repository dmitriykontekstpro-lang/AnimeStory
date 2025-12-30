import React from 'react';
import type { AIProvider } from '../types';

interface StoryDisplayProps {
  story: string;
  provider: AIProvider | null;
}

const parseStory = (text: string) => {
    // Use split with a capturing group to keep the delimiters.
    // This ensures all parts of the string are processed.
    const delimiterRegex = /((?:Страница|Page)\s*\d+[,.\s]+(?:Блок|Block)\s*\d+)/gi;
    const parts = text.split(delimiterRegex);

    // If no markers are found, or the text is simple, return it as a single block.
    if (parts.length <= 1) {
        return [{ page: 'История', blocks: [{ block: 'Полный текст', content: text.trim() }] }];
    }

    const pagesMap = new Map<string, { page: string; blocks: { block: string; content: string }[] }>();

    // Handle any text that might appear before the first marker.
    const initialContent = parts[0].trim();
    if (initialContent) {
        pagesMap.set("0", { // Use "0" as a key for sorting prologue first
            page: `Пролог`,
            blocks: [{
                block: 'Вступление',
                content: initialContent
            }]
        });
    }
    
    // Process the text in pairs of [marker, content].
    for (let i = 1; i < parts.length; i += 2) {
        const marker = parts[i];
        let content = (parts[i + 1] || '').trim();

        if (!marker || !content) {
            continue;
        }

        // Extract page and block numbers from the marker.
        const markerMatch = marker.match(/(?:Страница|Page)\s*(\d+)[,.\s]+(?:Блок|Block)\s*(\d+)/i);
        if (!markerMatch) {
            continue;
        }

        const pageNum = markerMatch[1];
        const blockNum = markerMatch[2];

        if (!pagesMap.has(pageNum)) {
            pagesMap.set(pageNum, {
                page: `Страница ${pageNum}`,
                blocks: []
            });
        }

        pagesMap.get(pageNum)!.blocks.push({
            block: `Блок ${blockNum}`,
            content: content
        });
    }

    // Convert map to array and sort numerically by page number, keeping prologue first.
    return Array.from(pagesMap.values()).sort((a, b) => {
        if (a.page.startsWith('Пролог')) return -1;
        if (b.page.startsWith('Пролог')) return 1;
        const pageNumA = parseInt(a.page.split(' ')[1]);
        const pageNumB = parseInt(b.page.split(' ')[1]);
        return pageNumA - pageNumB;
    });
};


export const StoryDisplay: React.FC<StoryDisplayProps> = ({ story, provider }) => {
  const parsedStory = parseStory(story);

  return (
    <div className="mt-8 w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-600">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          Финальный Результат: Ваша История
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
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
