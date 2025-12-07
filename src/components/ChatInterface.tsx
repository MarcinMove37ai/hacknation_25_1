"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquarePlus, X, Trash2, Menu } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Anthropic from '@anthropic-ai/sdk';
import { semanticSearch, loadKPAData, type KPAChunk } from '@/utils/semanticSearch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// INTERFEJSY
// ============================================================================

interface Source {
  id: string;
  article?: string;
  paragraph?: string;
  title: string;
  content: string;
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
// KOMPONENT ŹRÓDŁA (POPUP)
// ============================================================================

interface SourceCardProps {
  source: Source;
  onClose: () => void;
  kpaData: KPAChunk[];
}

const SourceCard: React.FC<SourceCardProps> = ({ source, onClose, kpaData }) => {
  // Znajdź wybrany chunk i sąsiednie
  const findContextChunks = () => {
    // Znajdź index wybranego chunku
    const currentIndex = kpaData.findIndex(
      chunk => chunk.art_no === source.article && chunk.par_no === source.paragraph
    );

    if (currentIndex === -1) {
      return { before: [], current: null, after: [] };
    }

    const before = kpaData.slice(Math.max(0, currentIndex - 3), currentIndex);
    const current = kpaData[currentIndex];
    const after = kpaData.slice(currentIndex + 1, currentIndex + 4);

    return { before, current, after };
  };

  const { before, current, after } = findContextChunks();

  const renderChunk = (chunk: KPAChunk, isCurrent = false) => {
    const label = [
      chunk.art_no ? `Art. ${chunk.art_no}` : '',
      chunk.par_no ? `§ ${chunk.par_no}` : '',
      chunk.pkt_no ? `pkt ${chunk.pkt_no}` : ''
    ].filter(Boolean).join(' ') || 'Fragment';

    return (
      <div
        className={`p-3 rounded-lg ${
          isCurrent
            ? 'bg-blue-50 border-2 border-blue-900'
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
          {chunk.text}
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
            Kontekst - {source.article && `Art. ${source.article}`}
            {source.paragraph && ` § ${source.paragraph}`}
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
          <div className="px-8 py-6 space-y-3">
            {/* Chunks przed */}
            {before.length > 0 && (
              <>
                <div className="text-xs text-gray-500 uppercase font-medium mb-2">
                  Poprzednie fragmenty:
                </div>
                {before.map((chunk, idx) => (
                  <div key={`before-${idx}`}>
                    {renderChunk(chunk, false)}
                  </div>
                ))}
                <div className="my-2 border-t border-gray-300" />
              </>
            )}

            {/* Wybrany chunk */}
            {current && (
              <>
                <div className="text-xs text-blue-900 uppercase font-medium mb-2">
                  Wybrany fragment:
                </div>
                <div key="current">
                  {renderChunk(current, true)}
                </div>
              </>
            )}

            {/* Chunks po */}
            {after.length > 0 && (
              <>
                <div className="my-2 border-t border-gray-300" />
                <div className="text-xs text-gray-500 uppercase font-medium mb-2">
                  Następne fragmenty:
                </div>
                {after.map((chunk, idx) => (
                  <div key={`after-${idx}`}>
                    {renderChunk(chunk, false)}
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
    }
  };

  // Generowanie tytułu czatu
  const generateChatTitle = async (chatId: number, firstMessage: string) => {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
        dangerouslyAllowBrowser: true
      });

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 20,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `Nazwij krótko (2-4 słowa) zagadnienie którego dotyczy pytanie. Użyj języka polskiego, bez znaków specjalnych i interpunkcji: "${firstMessage}"`
          }
        ]
      });

      let title = 'Nowy czat';
      if (response.content && response.content.length > 0) {
        const contentBlock = response.content[0];
        if ('text' in contentBlock) {
          title = contentBlock.text.trim();
        }
      }

      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, title }
          : chat
      ));
    } catch (error) {
      console.error('Błąd generowania tytułu:', error);
    }
  };

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
      // 1. SEMANTIC SEARCH - znajdź relevantne chunks z KPA
      console.log('🔍 Searching KPA database...');
      const searchResults = await semanticSearch(
        userMessage.content,
        kpaData,
        5
      );

      console.log(`📊 Found ${searchResults.length} relevant chunks`);

      // 2. PRZYGOTUJ KONTEKST z KPA dla Claude
      const kpaContext = searchResults.length > 0
        ? `\n\nRelevantne fragmenty z Kodeksu postępowania administracyjnego:\n\n${searchResults.map((r, idx) =>
            `[${idx + 1}] ${r.title}\n${r.content}`
          ).join('\n\n')}`
        : '';

      // 3. Inicjalizacja Anthropic SDK
      const anthropic = new Anthropic({
        apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
        dangerouslyAllowBrowser: true
      });

      // PAMIĘĆ KONWERSACJI - ostatnie 3 wymiany (max 6 wiadomości)
      // Bierzemy ostatnie wiadomości, ale max 6 (3 user + 3 assistant)
      const recentMessages = newMessages.slice(-6);

      const conversationHistory = recentMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      console.log(`💬 Wysyłam do Claude: ${conversationHistory.length} wiadomości (z ostatnich ${newMessages.length})`);

      // 4. WYWOŁANIE API Claude z kontekstem KPA
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: conversationHistory,
        system: `Jesteś pomocnym asystentem specjalizującym się w Kodeksie postępowania administracyjnego (KPA).

Odpowiadaj jasno, zwięźle i konkretnie na pytania dotyczące procedur administracyjnych.

KONTEKST ROZMOWY:
Masz dostęp do ostatnich wymian wiadomości z użytkownikiem. Wykorzystaj ten kontekst aby udzielać spójnych odpowiedzi i odnosić się do wcześniejszych pytań gdy jest to stosowne.

${kpaContext ? `ŹRÓDŁA Z KPA:\n${kpaContext}` : ''}

OBOWIĄZKOWE FORMATOWANIE - ZAWSZE UŻYWAJ MARKDOWN:

1. Strukturyzuj odpowiedź używając nagłówków:
   - ## Główna sekcja
   - ### Podsekcja

2. Podkreślaj kluczowe informacje:
   - **pogrubienie** dla ważnych terminów, liczb, dat
   - *kursywa* dla terminów prawniczych po raz pierwszy

3. Organizuj informacje w listy:
   - Listy numerowane (1., 2., 3.) dla kroków/procedur/terminów
   - Listy wypunktowane (- lub *) dla warunków/przykładów

4. Dodawaj odniesienia [1], [2], [3] do źródeł z KPA

PRZYKŁAD ODPOWIEDZI (SKOPIUJ TEN STYL):

## Terminy w postępowaniu administracyjnym

Zgodnie z KPA, organy administracji publicznej mają obowiązek załatwiać sprawy **bez zbędnej zwłoki**[1].

### Podstawowe terminy

1. **7 dni** - podstawowy termin załatwienia sprawy w prostych przypadkach[2]
2. **14 dni** - termin na wniesienie *odwołania* od decyzji[3]
3. **30 dni** - w sprawach szczególnie skomplikowanych, wymagających ekspertyz[4]

### Możliwość przedłużenia

W uzasadnionych przypadkach organ może przedłużyć termin, powiadamiając stronę o:
- przyczynie opóźnienia
- nowym przewidywanym terminie
- możliwości złożenia zażalenia

WAŻNE: Zawsze formatuj odpowiedź używając markdown jak w przykładzie powyżej. Nie pisz prostego tekstu bez formatowania!`
      });

      // 5. Wyciągnij odpowiedź z API
      let assistantContent = '';
      if (response.content && response.content.length > 0) {
        const contentBlock = response.content[0];
        if ('text' in contentBlock) {
          assistantContent = contentBlock.text;
        }
      }

      // 6. Przygotuj wiadomość ze źródłami
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: assistantContent || 'Przepraszam, nie udało mi się wygenerować odpowiedzi.',
        timestamp: new Date(),
        sources: searchResults.map(r => ({
          id: r.id,
          article: r.article,
          paragraph: r.paragraph,
          title: r.title,
          content: r.content,
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
              Asystent <span className="font-light">KPA</span>
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
                      Asystent <span className="font-light">KPA</span>
                    </div>
                    <p className="text-gray-500 text-lg">
                      Zadaj pytanie o Kodeks postępowania administracyjnego
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
                          placeholder="Zadaj pytanie o KPA..."
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
                            // Nagłówki
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
                            // Listy
                            ul: ({node, ...props}) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="ml-2" {...props} />,
                            // Pogrubienie i kursywa
                            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                            em: ({node, ...props}) => <em className="italic" {...props} />,
                            // UNIWERSALNE PARSOWANIE PRZYPISÓW - działa wszędzie
                            text: ({value}: any) => {
                              if (typeof value !== 'string') return value;

                              const parts = [];
                              const regex = /\[(\d+)\]/g;
                              let lastIndex = 0;
                              let match;

                              while ((match = regex.exec(value)) !== null) {
                                // Tekst przed przypisem
                                if (match.index > lastIndex) {
                                  parts.push(value.slice(lastIndex, match.index));
                                }

                                // Przypisy jako czerwone elementy (tylko wizualne, NIE klikalne)
                                parts.push(
                                  <sup
                                    key={`fn-${match.index}`}
                                    className="text-red-600 font-semibold mx-0.5"
                                  >
                                    [{match[1]}]
                                  </sup>
                                );

                                lastIndex = regex.lastIndex;
                              }

                              // Pozostały tekst
                              if (lastIndex < value.length) {
                                parts.push(value.slice(lastIndex));
                              }

                              return parts.length > 1 ? <>{parts}</> : value;
                            },
                            // Akapity
                            p: ({node, ...props}: any) => <p className="my-2 leading-relaxed" {...props} />,
                            // Kod
                            code: ({node, inline, ...props}: any) =>
                              inline
                                ? <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />
                                : <code className="block bg-gray-100 p-2 rounded my-2 text-sm" {...props} />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {/* Źródła jako klikalne linki w stopce (ŁAPKI TUTAJ) */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-300">
                          <p className="text-xs font-medium text-gray-600 mb-2">Przypisy:</p>
                          <div className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <button
                                key={source.id}
                                onClick={() => setSelectedSource(source)}
                                className="block w-full text-left text-xs text-gray-700 hover:text-blue-900 hover:bg-gray-50 px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                <span className="font-medium text-blue-900">[{idx + 1}]</span>{' '}
                                <span className="font-medium">
                                  {source.article && `Art. ${source.article}`}
                                  {source.paragraph && ` § ${source.paragraph}`}
                                </span>
                                {' - '}
                                <span className="text-gray-600">
                                  {source.content.substring(0, 60)}...
                                </span>
                              </button>
                            ))}
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
                        Przeszukuję Kodeks Postępowania Administracyjnego aby udzielić najlepszej odpowiedzi...
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
          kpaData={kpaData}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  );
};

export default ChatInterface;