import React from 'react';

interface AccordionSectionProps {
  title: string;
  systemPrompt: string | undefined;
  content: string | null;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, systemPrompt, content }) => {
  if (!systemPrompt && !content) {
    return null;
  }

  return (
    <details className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden transition-all duration-300">
      <summary className="px-4 py-3 font-medium text-slate-300 cursor-pointer hover:bg-slate-800/50 list-none flex justify-between items-center">
        {title}
        <svg className="w-5 h-5 transition-transform duration-200 transform details-marker" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </summary>
      <div className="p-4 border-t border-slate-700 bg-slate-900/20">
        {systemPrompt && (
          <div className="mb-4">
            <h4 className="font-semibold text-pink-400 mb-2">Системный промт:</h4>
            <pre className="text-sm bg-slate-900 p-3 rounded-md whitespace-pre-wrap font-mono text-slate-400 overflow-x-auto">
              {systemPrompt}
            </pre>
          </div>
        )}
        {content && (
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">Результат этапа:</h4>
            <pre className="text-sm bg-slate-900 p-3 rounded-md whitespace-pre-wrap text-slate-300 overflow-x-auto">
              {content}
            </pre>
          </div>
        )}
      </div>
      <style>{`
        details[open] > summary .details-marker {
          transform: rotate(180deg);
        }
        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </details>
  );
};


interface GenerationLogProps {
  plot: string | null;
  detailedStory: string | null;
  systemPrompts: {
    plot?: string;
    story?: string;
  };
}

export const GenerationLog: React.FC<GenerationLogProps> = ({
  plot,
  detailedStory,
  systemPrompts
}) => {
  const hasContent = plot || detailedStory || Object.keys(systemPrompts).length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="mt-8 w-full bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
      <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
        Процесс Генерации
      </h2>
      <div className="space-y-4">
        <AccordionSection 
          title="Шаг 1: Создание сюжета"
          systemPrompt={systemPrompts.plot}
          content={plot}
        />
        <AccordionSection 
          title="Шаг 2: Написание детальной истории"
          systemPrompt={systemPrompts.story}
          content={detailedStory}
        />
      </div>
    </div>
  );
};
