"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquarePlus, X, Trash2, Menu } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadKPAData, type KPAChunk } from '@/utils/semanticSearch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// INTERFEJSY
// ============================================================================

interface Source {
  id: string;
  act?: string;
  article?: string;
  paragraph?: string;
  point?: string;
  title: string;
  content: string;
  text_clean?: string;
  relevance_score?: number;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

interface Chat {
  id: number;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ============================================================================
// NOWY KOMPONENT ŹRÓDŁA (POPUP) - UŻYWA /api/context API
// ============================================================================
// Zastąp TYLKO sekcję od linii ~40 do ~176 w ChatInterface.tsx

// Nowy interfejs dla fragmentu z API
interface ContextFragment {
  id: string;
  act: string;
  art_no: string;
  par_no: string | null;
  pkt_no: string | null;
  text: string;
  text_clean: string;
}

interface SourceCardProps {
  source: Source;
  onClose: () => void;
}

const SourceCard: React.FC<SourceCardProps> = ({ source, onClose }) => {
  const [context, setContext] = useState<{
    before: ContextFragment[];
    current: ContextFragment | null;
    after: ContextFragment[];
  }>({ before: [], current: null, after: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchContext();
  }, [source]);

  const fetchContext = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          act: source.act,
          article: source.article,
          paragraph: source.paragraph || null,
          point: source.point || null
        })
      });

      if (!response.ok) {
        throw new Error('Błąd pobierania kontekstu');
      }

      const data = await response.json();
      setContext(data);
    } catch (error) {
      console.error('❌ Błąd ładowania kontekstu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFragment = (fragment: ContextFragment, isCurrent = false) => {
    const label = [
      fragment.act,
      fragment.art_no ? `Art. ${fragment.art_no}` : '',
      fragment.par_no ? `§ ${fragment.par_no}` : '',
      fragment.pkt_no ? `pkt ${fragment.pkt_no}` : ''
    ].filter(Boolean).join(' ') || 'Fragment';

    return (
      <div
        className={`p-4 rounded-lg ${
          isCurrent
            ? 'bg-blue-50 border-2 border-blue-500'
            : 'bg-gray-50 border border-gray-200'
        }`}
      >
        <div className={`text-sm font-bold mb-2 ${
          isCurrent ? 'text-blue-900' : 'text-gray-700'
        }`}>
          {isCurrent && '► '}{label}
        </div>
        <p className={`text-sm leading-relaxed ${
          isCurrent ? 'text-gray-900' : 'text-gray-600'
        }`}>
          {fragment.text}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-[90vw] max-h-[90vh] flex flex-col my-8 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-blue-900">
            Kontekst - {source.act && `${source.act} `}
            {source.article && `Art. ${source.article}`}
            {source.paragraph && ` § ${source.paragraph}`}
            {source.point && ` pkt ${source.point}`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f3f4f6'
        }}>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
            </div>
          ) : (
            <div className="px-8 py-6 space-y-3">
              {/* Fragmenty przed */}
              {context.before.length > 0 && (
                <>
                  <div className="text-xs text-gray-500 uppercase font-medium mb-2">
                    Poprzednie fragmenty:
                  </div>
                  {context.before.map((fragment) => (
                    <div key={`before-${fragment.id}`}>
                      {renderFragment(fragment, false)}
                    </div>
                  ))}
                  <div className="my-2 border-t border-gray-300" />
                </>
              )}

              {/* Wybrany fragment */}
              {context.current && (
                <>
                  <div className="text-xs text-blue-900 uppercase font-medium mb-2">
                    Wybrany fragment:
                  </div>
                  <div key="current">
                    {renderFragment(context.current, true)}
                  </div>
                </>
              )}

              {/* Fragmenty po */}
              {context.after.length > 0 && (
                <>
                  <div className="my-2 border-t border-gray-300" />
                  <div className="text-xs text-gray-500 uppercase font-medium mb-2">
                    Następne fragmenty:
                  </div>
                  {context.after.map((fragment) => (
                    <div key={`after-${fragment.id}`}>
                      {renderFragment(fragment, false)}
                    </div>
                  ))}
                </>
              )}

              {source.relevance_score && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Trafność wyszukiwania: {(source.relevance_score * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SIDEBAR (DESKTOP)
// ============================================================================

interface SidebarProps {
  chats: Chat[];
  currentChatId: number | null;
  onNewChat: () => void;
  onSelectChat: (chatId: number) => void;
  onDeleteChat: (chatId: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat
}) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onNewChat}
          className="w-full p-3 bg-blue-900 text-white rounded-lg flex items-center justify-between hover:bg-blue-800 transition-colors"
        >
          <span>Nowy czat</span>
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>

      {/* Historia czatów */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative p-3 rounded-lg transition-colors cursor-pointer ${
                currentChatId === chat.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-800 break-words line-clamp-2">
                    {chat.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {chat.createdAt.toLocaleDateString('pl-PL')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ============================================================================
// MOBILE MENU
// ============================================================================

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  currentChatId: number | null;
  onNewChat: () => void;
  onSelectChat: (chatId: number) => void;
  onDeleteChat: (chatId: number) => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm">
      <div className="h-full flex flex-col bg-white/95 backdrop-blur-sm shadow-lg m-4 rounded-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Nowy czat */}
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full p-3 bg-blue-900 text-white rounded-xl flex items-center justify-between hover:bg-blue-800 transition-colors"
          >
            <span>Nowy czat</span>
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <div className="w-full h-px bg-gray-200" />

          {/* Historia */}
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`relative p-3 rounded-xl border transition-colors ${
                  currentChatId === chat.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div
                  onClick={() => {
                    onSelectChat(chat.id);
                    onClose();
                  }}
                  className="cursor-pointer pr-10"
                >
                  <p className="text-sm font-medium text-gray-800 break-words line-clamp-2">
                    {chat.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {chat.createdAt.toLocaleDateString('pl-PL')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onDeleteChat(chat.id);
                    onClose();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// GŁÓWNY KOMPONENT CZATU
// ============================================================================

const ChatInterface: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [kpaData, setKpaData] = useState<KPAChunk[]>([]);

  // Zmiana: Przechowujemy historię wiedzy jako tablicę (do 3 ostatnich wpisów)
  const [knowledgeHistory, setKnowledgeHistory] = useState<string[]>([]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Załaduj KPA data przy mount
  useEffect(() => {
    loadKPAData().then(data => {
      setKpaData(data);
      console.log(`📚 KPA data loaded: ${data.length} chunks`);
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Nowy czat
  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now(),
      title: 'Nowy czat',
      messages: [],
      createdAt: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);
    setKnowledgeHistory([]); // Resetujemy wiedzę przy nowym czacie
  };

  // Wybór czatu
  const handleSelectChat = (chatId: number) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setMessages(chat.messages);
    }
  };

  // Usuń czat
  const handleDeleteChat = (chatId: number) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
      setKnowledgeHistory([]);
    }
  };

  // Generowanie tytułu czatu przez API
  const generateChatTitle = async (chatId: number, firstMessage: string) => {
    try {
      const response = await fetch('/api/chat-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMessage })
      });

      if (!response.ok) throw new Error('Błąd generowania tytułu');

      const data = await response.json();

      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, title: data.title }
          : chat
      ));

    } catch (error) {
      console.error('Nie udało się wygenerować tytułu:', error);
      const fallbackTitle = firstMessage.split(' ').slice(0, 4).join(' ') + '...';

      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, title: fallbackTitle }
          : chat
      ));
    }
  };

  // Wysłanie wiadomości
  // Wysłanie wiadomości
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Utwórz nowy czat jeśli nie ma aktywnego
    let chatId = currentChatId;
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now(),
        title: input.trim().slice(0, 50) + '...',
        messages: [],
        createdAt: new Date()
      };
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      chatId = newChat.id;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      console.log('\n🔵 --- DIAGNOSTYKA: START TURY ROZMOWY ---');

      // 1. PRZYGOTOWANIE KONTEKSTU DLA WYSZUKIWARKI
      // Łączymy ostatnie 3 podsumowania w jeden ciąg tekstu
      const contextString = knowledgeHistory.join(' ');

      // Tworzymy "Wzbogacone Zapytanie" dla bazy wektorowej
      const queryForSearch = contextString
        ? `${userMessage.content} (Kontekst z poprzednich pytań: ${contextString})`
        : userMessage.content;

      // LOG DIAGNOSTYCZNY 1
      console.log('🔵 Query do VDB (Search):', queryForSearch);

      // 1. SEMANTIC SEARCH
      const searchResponse = await fetch('/api/acts-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryForSearch }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Błąd API wyszukiwania: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      console.log(`📊 Wyniki VDB: ${searchData.cumulated.length} cumulated, ${searchData.detailed.length} detailed`);

      // 2. CONTEXT BUILDING
      console.log('🏗️ Budowanie kontekstu XML...');
      const cumulatedIds = searchData.cumulated.map((r: any) => parseInt(r.id));
      const actsIds = searchData.detailed.map((r: any) => parseInt(r.id));

      const contextResponse = await fetch('/api/build-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cumulatedIds: cumulatedIds,
          actsIds: actsIds
        })
      });

      if (!contextResponse.ok) {
        throw new Error('Błąd podczas budowania kontekstu');
      }

      const { context } = await contextResponse.json();

      // PAMIĘĆ KONWERSACJI
      const recentMessages = newMessages.slice(-6);
      const conversationHistory = recentMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // LOG DIAGNOSTYCZNY 2
      const fullKnowledgeSummary = knowledgeHistory.join('\n\n');
      console.log('🟣 Query do LLM (Payload):', {
        messagesCount: conversationHistory.length,
        knowledgeHistoryLength: knowledgeHistory.length,
        knowledgeContent: fullKnowledgeSummary
      });

      // 3. WYWOŁANIE API CHATU
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          context: context,
          knowledgeSummary: fullKnowledgeSummary // Wysyłamy złączoną wiedzę
        }),
      });

      if (!chatResponse.ok) {
        throw new Error(`Chat API Error: ${chatResponse.statusText}`);
      }

      const chatData = await chatResponse.json();
      let rawContent = chatData.content || '';
      let cleanContent = rawContent;
      let usedSourceIds: string[] = [];

      // --- LOGIKA: Parsowanie i Ukrywanie JSON ---
      // POPRAWKA: Regex akceptuje teraz brak słowa "json" po ``` (np. ``` { ... } ```)
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = rawContent.match(jsonRegex);

      if (match) {
        try {
          const jsonBlock = JSON.parse(match[1]);

          // LOG DIAGNOSTYCZNY 3
          console.log('🟢 JSON Odpowiedzi:', JSON.stringify(jsonBlock, null, 2));

          // Logika Rolling Window (Max 3 ostatnie podsumowania)
          if (jsonBlock.summary_for_next_turn) {
            console.log('🧠 Dodaję nowe podsumowanie do historii:', jsonBlock.summary_for_next_turn);

            setKnowledgeHistory(prev => {
              const newHistory = [...prev, jsonBlock.summary_for_next_turn];
              // Zatrzymujemy tylko 3 ostatnie
              return newHistory.slice(-3);
            });
          }

          if (jsonBlock.sources && Array.isArray(jsonBlock.sources)) {
            usedSourceIds = jsonBlock.sources.map((s: any) => s.id.toString());
          }

          // Usuwamy JSON z widoku
          cleanContent = rawContent.replace(match[0], '').trim();

        } catch (e) {
          console.error('❌ Błąd parsowania ukrytego JSON-a:', e);
          // Jeśli parsowanie zawiedzie, usuwamy surowy blok, ale content zostaje
          cleanContent = rawContent.replace(jsonRegex, '').trim();
        }
      } else {
        console.warn('⚠️ Brak bloku JSON w odpowiedzi modelu.');
      }
      // -------------------------------------------

      // 4. Przygotowanie źródeł
      const allAvailableData = [...searchData.cumulated, ...searchData.detailed];

      const finalSources = usedSourceIds.length > 0
        ? usedSourceIds.map(id => {
            const found = allAvailableData.find((item: any) => item.id.toString() === id);
            return found;
          }).filter(Boolean)
        : [];

      // POPRAWKA: Fallback - jeśli filtrowanie zwróci 0 wyników (bo np. błąd JSON), pokaż wszystko co znaleziono
      // Dzięki temu użytkownik nigdy nie zostaje bez źródeł
      const sourcesToDisplay = finalSources.length > 0 ? finalSources : allAvailableData;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: cleanContent || 'Przepraszam, nie udało mi się wygenerować odpowiedzi.',
        timestamp: new Date(),
        sources: sourcesToDisplay.map((r: any) => ({
          id: r.id,
          act: r.act,
          article: r.article,
          paragraph: r.paragraph,
          title: r.title,
          content: r.content,
          text_clean: r.text_clean,
          relevance_score: r.relevance_score
        }))
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: updatedMessages }
          : chat
      ));

      if (newMessages.length === 1) {
        generateChatTitle(chatId, userMessage.content);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('❌ Błąd wywołania API:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Przepraszam, wystąpił błąd podczas przetwarzania Twojego pytania. Sprawdź klucze API lub spróbuj ponownie.',
        timestamp: new Date(),
        sources: []
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);

      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: updatedMessages }
          : chat
      ));

      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full bg-gradient-to-b from-blue-50/30 to-white">
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <Sidebar
          chats={chats}
          currentChatId={currentChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
        />
      )}

      {/* Główny obszar czatu */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        {isMobile && (
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
            <div className="text-lg font-bold text-blue-900">
              Asystent <span className="font-light">LegalGPT.pl</span>
            </div>
            <div className="w-10" />
          </div>
        )}

        {/* Obszar wiadomości */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  {/* Logo i opis */}
                  <div className="space-y-6 mb-8">
                    <div className="text-4xl font-bold text-blue-900">
                      Legal<span className="font-light">GPT.pl </span><span className="text-xs font-light">(v.1 beta/MVP)</span>
                    </div>
                    <p className="text-gray-500 text-lg">
                      Zadaj pytanie do KPK, KPA, KPC, KPE i SUS
                    </p>
                  </div>

                  {/* Input w centrum ekranu */}
                  <div className="w-full max-w-2xl">
                    <form onSubmit={handleSubmit} className="relative">
                      <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl shadow-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Zadaj pytanie..."
                          className="flex-1 px-4 py-3 bg-transparent border-0 outline-none resize-none max-h-[200px] min-h-[52px] text-gray-900 placeholder:text-gray-400"
                          rows={1}
                          disabled={isLoading}
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!input.trim() || isLoading}
                          className={`m-2 p-2.5 rounded-xl transition-all ${
                            input.trim() && !isLoading
                              ? 'bg-blue-900 text-white hover:bg-blue-800 shadow-sm'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        Naciśnij Enter aby wysłać, Shift+Enter dla nowej linii
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[95%] md:max-w-[90%] rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-blue-900 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {/* Treść wiadomości z markdown */}
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                              // Nagłówki (bez zmian)
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,

                              // --- POPRAWKA LISTOWANIA ---
                              // 1. Zmieniamy 'list-inside' na 'list-outside'
                              // 2. Dodajemy 'ml-5' (margines lewy), żeby kropki/cyfry nie wyjechały poza ekran
                              // 3. 'space-y-1' zapewnia ładny odstęp między punktami
                              ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 my-2 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 my-2 space-y-1" {...props} />,

                              // Opcjonalnie mały padding dla elementu listy
                              li: ({node, ...props}) => <li className="pl-1" {...props} />,
                              // ---------------------------

                              // Pogrubienie i kursywa (bez zmian)
                              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,

                              // UNIWERSALNE PARSOWANIE PRZYPISÓW (bez zmian)
                              text: ({value}: any) => {
                                // ... (Twój kod parsowania przypisów zostaje bez zmian) ...
                                if (typeof value !== 'string') return value;
                                const parts = [];
                                const regex = /\[(\d+)\]/g;
                                let lastIndex = 0;
                                let match;
                                while ((match = regex.exec(value)) !== null) {
                                  if (match.index > lastIndex) {
                                    parts.push(value.slice(lastIndex, match.index));
                                  }
                                  parts.push(
                                    <sup key={`fn-${match.index}`} className="text-red-600 font-semibold mx-0.5">
                                      [{match[1]}]
                                    </sup>
                                  );
                                  lastIndex = regex.lastIndex;
                                }
                                if (lastIndex < value.length) {
                                  parts.push(value.slice(lastIndex));
                                }
                                return parts.length > 1 ? <>{parts}</> : value;
                              },

                              // Akapity
                              // WAŻNE: Dodajemy klasę [&:not(:first-child)]:mt-2 zamiast zwykłego my-2,
                              // aby uniknąć dziwnych odstępów wewnątrz list
                              p: ({node, ...props}: any) => <p className="my-2 leading-relaxed" {...props} />,

                              // Kod (bez zmian)
                              code: ({node, inline, ...props}: any) =>
                                inline
                                  ? <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />
                                  : <code className="block bg-gray-100 p-2 rounded my-2 text-sm" {...props} />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {/* Źródła jako klikalne linki w stopce */}
                      {message.sources && message.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-300">
                            <p className="text-xs font-medium text-gray-600 mb-2">Przypisy:</p>
                            <div className="space-y-1">
                              {message.sources.map((source, idx) => {
                                // Budowanie pełnej etykiety z aktem i punktami
                                const label = [
                                  source.act,
                                  source.article && `Art. ${source.article}`,
                                  source.paragraph && `§ ${source.paragraph}`,
                                  source.point && `pkt ${source.point}`
                                ].filter(Boolean).join(' ');

                                return (
                                  <button
                                    key={`${source.id}-${idx}`}
                                    onClick={() => setSelectedSource(source)}
                                    className="block w-full text-left text-xs text-gray-700 hover:text-blue-900 hover:bg-gray-50 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    <span className="font-medium text-blue-900">[{idx + 1}]</span>{' '}
                                    <span className="font-medium">{label}</span>
                                    {' - '}
                                    <span className="text-gray-600">
                                      {source.content.substring(0, 60)}...
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                      )}

                      <div
                        className={`text-xs mt-2 ${
                          message.type === 'user' ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loader */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-900 flex-shrink-0" />
                      <span className="text-sm text-gray-600">
                        Przeszukuję dostępne Akty Prawne aby udzielić najlepszej odpowiedzi...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input - pokazuje się tylko gdy są wiadomości */}
        {messages.length > 0 && (
        <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Zadaj pytanie o KPA..."
                  className="flex-1 px-4 py-3 bg-transparent border-0 outline-none resize-none max-h-[200px] min-h-[52px] text-gray-900 placeholder:text-gray-400"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`m-2 p-2.5 rounded-xl transition-all ${
                    input.trim() && !isLoading
                      ? 'bg-blue-900 text-white hover:bg-blue-800 shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">
                Naciśnij Enter aby wysłać, Shift+Enter dla nowej linii
              </div>
            </form>
          </div>
        </div>
        )}
      </div>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* Source Card Popup */}
      {selectedSource && (
        <SourceCard
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  );
};

export default ChatInterface;