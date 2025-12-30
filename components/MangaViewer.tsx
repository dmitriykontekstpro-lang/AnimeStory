import React, { useState, useEffect, useMemo } from 'react';
import { fetchStory } from '../services/supabaseClient.ts';
import { generateMangaImage } from '../services/imageService.ts';

interface MangaViewerProps {
  storyId: number;
}

interface StoryBlock {
    id: string; // e.g., p1_b1
    block: string;
    content: string;
    dialogue?: string;
}

interface StoryPage {
    page: string;
    blocks: StoryBlock[];
    narrative: string;
}

type DisplayItem = 
  | { type: 'prologue'; content: string; }
  | ({ type: 'manga' } & StoryPage);


const parseStoryForManga = (data: any): StoryPage[] => {
    if (!data) return [];
    
    const pagesMap = new Map<string, { page: string, blocks: StoryBlock[] }>();

    for (const key in data) {
        const contentMatch = key.match(/^p(\d+)_b(\d+)$/);
        const dialogueMatch = key.match(/^p(\d+)_b(\d+)_dialogue$/);

        if (contentMatch) {
            const pageNum = contentMatch[1];
            const blockNum = parseInt(contentMatch[2]);
            const content = data[key];
            if (content) {
                if (!pagesMap.has(pageNum)) {
                    pagesMap.set(pageNum, { page: `Страница ${pageNum}`, blocks: [] });
                }
                const page = pagesMap.get(pageNum)!;
                const blockId = `p${pageNum}_b${blockNum}`;
                if (!page.blocks[blockNum - 1]) {
                    page.blocks[blockNum - 1] = { id: blockId, block: `Блок ${blockNum}`, content: '' };
                }
                page.blocks[blockNum - 1].content = content;
            }
        } else if (dialogueMatch) {
            const pageNum = dialogueMatch[1];
            const blockNum = parseInt(dialogueMatch[2]);
            const dialogue = data[key];
            const page = pagesMap.get(pageNum);
            if (page && page.blocks[blockNum - 1] && dialogue) {
                page.blocks[blockNum - 1].dialogue = dialogue;
            }
        }
    }
    
    return Array.from(pagesMap.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([_, pageData]) => {
            const cleanBlocks = pageData.blocks.filter(Boolean);
            const narrative = cleanBlocks.map(b => b.content).join('\n\n');
            return {
                ...pageData,
                blocks: cleanBlocks,
                narrative: narrative
            };
        });
};

const DialogueBubble: React.FC<{ text: string }> = ({ text }) => {
  const positionStyle = useMemo(() => {
    // Ensure the bubble doesn't get too close to the edges
    const top = Math.floor(Math.random() * 50) + 20; // 20% to 70% from top
    const left = Math.floor(Math.random() * 50) + 20; // 20% to 70% from left
    const rotation = Math.floor(Math.random() * 16) - 8; // -8 to 8 degrees
    return {
      top: `${top}%`,
      left: `${left}%`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    };
  }, []); // Empty dependency array ensures this runs only once per component instance

  return (
    <div
      className="absolute p-5 bg-white text-black font-bold text-xs shadow-lg border-2 border-black max-w-[80%] z-10"
      style={{
        ...positionStyle,
        borderRadius: '50% / 40%', // Elliptical shape
      }}
    >
      <pre className="whitespace-pre-wrap font-sans">{text}</pre>
    </div>
  );
};

const PageLayoutGrid: React.FC<{ blocks: StoryBlock[]; images: Record<string, string> }> = ({ blocks, images }) => {
    const gridClass = {
        1: 'grid-cols-1 grid-rows-1',
        2: 'grid-cols-2 grid-rows-1',
        3: 'grid-cols-3 grid-rows-1',
        4: 'grid-cols-2 grid-rows-2',
        5: 'grid-cols-3 grid-rows-2',
        6: 'grid-cols-3 grid-rows-2',
    }[blocks.length] || 'grid-cols-3';
    
    const specialSpan = {
        5: ['col-span-1', 'col-span-1', 'col-span-1', 'col-span-1 row-start-2', 'col-span-2 row-start-2'],
    }

    return (
        <div className={`grid ${gridClass} gap-1 w-full h-full`}>
            {blocks.map((block, index) => (
                <div key={block.id} className={`relative bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden ${specialSpan[5]?.[index] ?? ''}`}>
                    {images[block.id] ? (
                        <img src={images[block.id]} alt={`Изображение для ${block.block}`} className="w-full h-full object-cover" />
                    ) : (
                         <div className="text-slate-500 text-sm p-2 text-center">...</div>
                    )}
                    {block.dialogue && <DialogueBubble text={block.dialogue} />}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black text-white text-xs font-bold rounded-full opacity-70">{block.id.split('_')[1].replace('b','')}</div>
                </div>
            ))}
        </div>
    );
};

const ArrowButton: React.FC<{direction: 'left' | 'right', onClick: () => void, disabled: boolean}> = ({direction, onClick, disabled}) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`absolute top-1/2 -translate-y-1/2 ${direction === 'left' ? 'left-2' : 'right-2'} z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed`}
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor">
            {direction === 'left' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            )}
        </svg>
    </button>
);

export const MangaViewer: React.FC<MangaViewerProps> = ({ storyId }) => {
    const [storyData, setStoryData] = useState<any | null>(null);
    const [storyPages, setStoryPages] = useState<StoryPage[]>([]);
    const [images, setImages] = useState<Record<string, string>>({});
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const loadStoryData = async () => {
            setError(null);
            setStoryPages([]);
            setImages({});
            setIsGenerating(false);
            setCurrentPageIndex(0);
            try {
                const data = await fetchStory(storyId);
                setStoryData(data);
                const parsed = parseStoryForManga(data);
                setStoryPages(parsed);
            } catch (err: any) {
                setError(err.message);
            }
        };

        if (storyId) {
            loadStoryData();
        }
    }, [storyId]);

    const handleGenerateManga = async () => {
        if (!storyPages.length) return;
        
        setIsGenerating(true);
        setError(null);
        const allBlocks = storyPages.flatMap(p => p.blocks);
        setGenerationProgress({ current: 0, total: allBlocks.length });

        try {
            for (let i = 0; i < allBlocks.length; i++) {
                const block = allBlocks[i];
                if (images[block.id]) {
                   setGenerationProgress(prev => ({ ...prev, current: prev.current + 1 }));
                   continue;
                }
                const imageUrl = await generateMangaImage(block.content);
                setImages(prevImages => ({ ...prevImages, [block.id]: imageUrl }));
                setGenerationProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const hasGeneratedImages = useMemo(() => {
        if (!storyPages.length) return false;
        const totalBlocks = storyPages.flatMap(p => p.blocks).length;
        return Object.keys(images).length >= totalBlocks && totalBlocks > 0;
    }, [images, storyPages]);

    const displayItems = useMemo<DisplayItem[]>(() => {
        if (!storyData || storyPages.length === 0) return [];
        
        const prologueText = storyPages
            .map(page => page.narrative)
            .join('\n\n')
            .trim();

        const prologue = { 
            type: 'prologue' as const, 
            content: prologueText
        };
        const mangaPages = storyPages.map(page => ({ type: 'manga' as const, ...page }));
        return [prologue, ...mangaPages];
    }, [storyData, storyPages]);

    const currentItem = displayItems[currentPageIndex];

    const handleNext = () => setCurrentPageIndex(prev => Math.min(prev + 1, displayItems.length - 1));
    const handlePrev = () => setCurrentPageIndex(prev => Math.max(prev - 1, 0));

    return (
        <div className="w-full bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
            {/* Header: Title, Page Info, and Generate Button */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4 pb-4 border-b border-slate-700">
                <h2 className="text-2xl font-bold text-purple-400">
                    Ваша Манга #{storyId}
                </h2>
                
                <div className="flex items-center gap-6">
                    {displayItems.length > 0 && (
                        <div className="text-lg text-slate-400 font-semibold text-right">
                           {currentItem?.type === 'prologue' ? 'Пролог' : currentItem?.page}
                           <span className="block text-sm">({currentPageIndex + 1} / {displayItems.length})</span>
                        </div>
                    )}
                    
                    {!isGenerating && !hasGeneratedImages && storyPages.length > 0 && (
                        <button
                            onClick={handleGenerateManga}
                            className="px-6 py-2.5 font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 rounded-lg shadow-lg hover:from-red-700 hover:to-orange-600 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-red-500/50 transform hover:scale-105"
                        >
                            Сгенерировать Изображения
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar & Error Display */}
            <div className="mb-4 min-h-[40px] flex flex-col justify-center">
                 {isGenerating && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-base font-medium text-slate-300">Генерация...</span>
                            <span className="text-sm font-medium text-slate-400">{generationProgress.current} из {generationProgress.total}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-red-600 to-orange-500 h-2.5 rounded-full" style={{ width: `${(generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0)}%` }}></div>
                        </div>
                    </div>
                )}
                {error && <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">{error}</div>}
            </div>
            
            {/* Viewer and Narration */}
            <div className="w-full flex flex-col gap-4">
                 {displayItems.length > 0 ? (
                    <div className="relative w-full aspect-[16/9] bg-black border-2 border-slate-600 p-1 flex items-center justify-center rounded-lg">
                        <ArrowButton direction="left" onClick={handlePrev} disabled={currentPageIndex === 0} />
                        
                        {currentItem?.type === 'prologue' && (
                             <div className="p-4 h-full overflow-y-auto text-slate-300">
                                <h3 className="text-xl font-bold mb-4 text-center text-pink-400">Пролог</h3>
                                <p className="whitespace-pre-wrap text-base leading-relaxed">{currentItem.content}</p>
                            </div>
                        )}

                        {currentItem?.type === 'manga' && (
                           <PageLayoutGrid blocks={currentItem.blocks} images={images} />
                        )}
                        
                        <ArrowButton direction="right" onClick={handleNext} disabled={currentPageIndex === displayItems.length - 1} />
                    </div>
                ) : (
                    <div className="aspect-[16/9] bg-black border-2 border-slate-600 rounded-lg flex items-center justify-center">
                        <p className="text-slate-500">Загрузка данных истории...</p>
                    </div>
                )}
                 {currentItem?.type === 'manga' && (
                    <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                         <h4 className="font-bold text-sm mb-1 text-pink-400">Повествование:</h4>
                         <p className="whitespace-pre-wrap text-sm italic text-slate-300">{currentItem.narrative}</p>
                    </div>
                )}
            </div>
        </div>
    );
};