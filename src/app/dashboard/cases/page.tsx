"use client"

import React, { useState, useEffect } from 'react';
import { getDecisionsAction } from '@/app/actions';
import { useLayout } from '../layout';
import { useSearchParams } from 'next/navigation';
import {
  FileText, ChevronDown, Search, Filter, Download, Clock,
  CheckCircle, AlertCircle, Calendar, Scale, Play, Send, Upload, File, Eye,
  Building2, Hourglass, X, Loader2, Ban
} from 'lucide-react';

// --- TYPY DANYCH ---

type DecisionStatus = 'new' | 'in_progress' | 'closed' | 'pending';
type DocStatus = 'new' | 'processed' | 'in_acceptance' | 'waiting';

interface PrismaDecision {
  id: string;
  decisionNumber: string | null;
  documentDate: string | null;
  signedBy: string | null;
  status: string | null;
  filePath: string | null;
  organizator: string | null;
  createdAt: Date | string;
  appealDays: number | null;
  decisionText: string | null;

  // dokładnie tak, jak nazwa relacji w include: { extensionDraft: true }
  extensionDraft?: { id: string } | null;
}

interface AttachedDocument {
  id: string;
  name: string;
  type: 'PDF' | 'DOC';
  date: string;
  size: string;
  status: DocStatus;
  filePath?: string | null;
  url?: string | null;
}

interface DecisionRecord {
  id: string;
  decisionNumber: string;
  organizer: string;
  documentDate: string;
  createdAt: string;
  signedBy: string;
  daysRemaining: number | null;
  status: DecisionStatus;
  decisionText: string | null;
  documents: AttachedDocument[];
}

// formularz edycji przedłużenia
interface ExtensionFormState {
  decisionNumber: string;
  organizer: string;
  legalForm: string;
  organizerAddress: string;
  documentDate: string;
  decisionText: string;
}

// --- KOMPONENTY UI ---

const MainStatusBadge = ({ status }: { status: DecisionStatus }) => {
  const config = {
    new: { label: 'Nowy', color: 'bg-blue-600 text-white', icon: Clock },
    in_progress: { label: 'W toku', color: 'bg-blue-100 text-blue-700', icon: Clock },
    closed: { label: 'Zakończone', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    pending: { label: 'Do wyjaśnienia', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  };
  const { label, color, icon: Icon } = config[status] || config['new'];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

const FileIcon = ({ type }: { type: 'PDF' | 'DOC' }) => {
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
      type === 'PDF' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
    }`}>
      {type === 'PDF' ? <FileText size={20} /> : <File size={20} />}
    </div>
  );
};

// --- LOGIKA KOLUMN ---

const renderDocStatus = (status: DocStatus) => {
  const baseClass = "text-xs font-bold px-3 py-1.5 rounded border text-center w-full block";
  switch (status) {
    case 'new': return <span className={`${baseClass} text-blue-600 bg-blue-50 border-blue-100`}>Nowy</span>;
    case 'processed': return <span className={`${baseClass} text-green-600 bg-green-50 border-green-100`}>Przetworzony</span>;
    case 'in_acceptance':
      return (
        <span className={`${baseClass} text-amber-600 bg-amber-50 border-amber-100`}>
          Edycja i podpisywanie
        </span>
      );
    case 'waiting': return <span className={`${baseClass} text-gray-400 bg-gray-50 border-gray-200`}>Oczekuje</span>;
    default: return null;
  }
};

const renderPrimaryAction = ({
  doc,
  decision,
  isProcessing,
  onProcessAppeal,
  acceptedExtensions,
  sentToSign,
}: {
  doc: AttachedDocument;
  decision: DecisionRecord;
  isProcessing: boolean;
  onProcessAppeal: () => void;
  acceptedExtensions: Set<string>;
  sentToSign: Set<string>;
}) => {
  const btnBase =
    "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm w-full cursor-pointer";

  // „Odwołanie" – przycisk PRZETWARZAJ (tylko gdy status = new)
  if (doc.name === 'Odwołanie') {
    if (doc.status === 'new') {
      return (
        <button
          className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed`}
          disabled={isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            onProcessAppeal();
          }}
        >
          {isProcessing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Przetwarzanie...
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              Przetwarzaj
            </>
          )}
        </button>
      );
    }

    return <div className="h-9 w-full" />;
  }

  if (doc.name === 'Przedłużenie' && doc.status === 'in_acceptance') {
    const isAccepted = acceptedExtensions.has(decision.id);
    const isSentToSign = sentToSign.has(decision.id);

    // Jeśli wysłano do podpisu - pokaż status "Oczekuje na podpis"
    if (isSentToSign) {
      return (
        <div className="w-full">
          <button
            className={`${btnBase} bg-purple-50 text-purple-600 border border-purple-200 cursor-default`}
            disabled
          >
            <Hourglass size={16} />
            Oczekuje na podpis
          </button>
        </div>
      );
    }

    if (!isAccepted) {
      return (
        <div className="cursor-not-allowed w-full" title="Najpierw zaakceptuj treść dokumentu (Pobierz / Edytuj)">
          <button
            className={`${btnBase} bg-emerald-50 text-emerald-300 border border-dashed border-emerald-200 pointer-events-none`}
            disabled
          >
            Pobierz lub edytuj
          </button>
        </div>
      );
    }

    // Jeśli zaakceptowano - pokaż aktywny przycisk
    return (
      <button
        className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md`}
        onClick={(e) => {
          e.stopPropagation();
          onProcessAppeal(); // to will call openSignModal
        }}
      >
        <Send size={16} />
        Wyślij do podpisu
      </button>
    );
  }

  return <div className="h-9 w-full" />;
};

/**
 * Akcje pliku – dostaje doc + decision + callbacki:
 * - onDownloadExtension (Pobierz)
 * - onEditExtension (Edytuj)
 */
const renderFileAction = (
  doc: AttachedDocument,
  decision: DecisionRecord,
  onDownloadExtension: () => void,
  onEditExtension: () => void,
  sentToSign: Set<string>
) => {
  const { status, filePath } = doc;
  const isSentToSign = sentToSign.has(decision.id);

  const btnBase = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full cursor-pointer";
  const btnSecondary = `${btnBase} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`;
  const btnDashed = `${btnBase} bg-white text-gray-700 border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50`;
  const btnDisabled = `${btnBase} bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50`;

  // 🔹 Odwołanie – zawsze PODGLĄD
  if (doc.name === 'Odwołanie') {
    return (
      <a
        href={doc.filePath ? `/api/assets/${doc.filePath.split('/').pop()}` : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={btnSecondary}
      >
        <Eye size={16} />
        Podgląd
      </a>
    );
  }

  // 🔹 Przedłużenie – blokuj jeśli wysłano do podpisu
  if (doc.name === 'Przedłużenie' && isSentToSign) {
    return (
      <div className="cursor-not-allowed w-full">
        <button className={btnDisabled} disabled>
          <Download size={16} />
          Zablokowane
        </button>
      </div>
    );
  }

  switch (status) {
    case 'new':
      return <div className="h-9 w-full" />;

    case 'processed':
      if (!filePath) {
        return (
          <span className="text-xs text-gray-400 italic">
            Brak pliku do pobrania
          </span>
        );
      }
      return (
        <a
          href={filePath}
          target="_blank"
          rel="noopener noreferrer"
          className={btnSecondary}
        >
          <Download size={16} />
          Pobierz
        </a>
      );

    case 'in_acceptance':
      // 🔹 Przedłużenie – dwa przyciski: Pobierz i Edytuj
      if (doc.name === 'Przedłużenie' && doc.type === 'DOC') {
        return (
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              className={btnSecondary}
              onClick={(e) => {
                e.stopPropagation();
                onDownloadExtension();
              }}
            >
              <Download size={16} />
              Pobierz
            </button>
            <button
              className={btnSecondary}
              onClick={(e) => {
                e.stopPropagation();
                onEditExtension();
              }}
            >
              <FileText size={16} />
              Edytuj
            </button>
          </div>
        );
      }
      return (
        <button className={btnDashed}>
          <Upload size={16} />
          Dodaj plik
        </button>
      );

    case 'waiting':
      return <div className="h-9 w-full"></div>;

    default:
      return null;
  }
};

// --- GŁÓWNY KOMPONENT ---

export default function SciezkaPrawnaPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<DecisionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  // modal debug
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugRecord, setDebugRecord] = useState<DecisionRecord | null>(null);
  const [acceptedExtensions, setAcceptedExtensions] = useState<Set<string>>(new Set());

  // modal EDYCJI PRZEDŁUŻENIA
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExtensionFormState | null>(null);
  const [extensionDrafts, setExtensionDrafts] = useState<Record<string, ExtensionFormState>>({});

  // modal WYSYŁKI DO PODPISU
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signDecisionId, setSignDecisionId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sentToSign, setSentToSign] = useState<Set<string>>(new Set());

  const openDebugModal = (record: DecisionRecord) => {
    setDebugRecord(record);
    setDebugModalOpen(true);
  };

  const closeDebugModal = () => {
    setDebugModalOpen(false);
    setDebugRecord(null);
  };

  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status') as DecisionStatus | null;

  const { refreshStats } = useLayout();

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getDecisionsAction();

        console.log('RAW decisions from DB:', result.data);

        if (result.success && result.data) {
          // @ts-ignore – struktura z Prisma
          const rawDecisions = result.data as PrismaDecision[];

          // 🔹 Na podstawie obecności ExtensionDraft ustalamy,
          //    dla których spraw pokazujemy od razu krok "Wyślij do podpisu"
          const initialAccepted = new Set<string>();

          const mappedData = rawDecisions.map((dbRecord: PrismaDecision) => {
            if (dbRecord.extensionDraft) {
              initialAccepted.add(dbRecord.id);
            }
            return transformToUiModel(dbRecord);
          });

          console.log('Mapped decisions data (DecisionRecord[]):', mappedData);

          mappedData.sort((a, b) => {
            if (a.daysRemaining === null) return 1;
            if (b.daysRemaining === null) return -1;
            return a.daysRemaining - b.daysRemaining;
          });

          setData(mappedData);
          setAcceptedExtensions(initialAccepted);

          await refreshStats();
        }

      } catch (e) {
        console.error("Failed to load decisions", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const transformToUiModel = (dbRecord: PrismaDecision): DecisionRecord => {
  console.log('DB record in transformToUiModel:', dbRecord);

  let daysRemaining: number | null = null;

  if (dbRecord.createdAt && typeof dbRecord.appealDays === 'number') {
    try {
      const createdDate = new Date(dbRecord.createdAt);
      const today = new Date();
      createdDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - createdDate.getTime();
      const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysRemaining = dbRecord.appealDays - daysPassed;
    } catch (error) {
      daysRemaining = null;
    }
  }

  const createdAtDisplay =
    dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString().slice(0, 10) : '-';

  // domyślne statusy – dokładnie jak dotychczas
  let decisionStatus: DecisionStatus = (dbRecord.status as DecisionStatus) ?? 'new';
  let appealStatus: DocStatus = 'new';
  let extensionStatus: DocStatus = 'waiting';
  let finalStatus: DocStatus = 'waiting';

  // 🔍 sprawdzamy, czy jest powiązany ExtensionDraft
  const hasExtensionDraft = !!dbRecord.extensionDraft;

  // jeśli jest ExtensionDraft → przeskakujemy od razu do ostatniego kroku
  if (hasExtensionDraft) {
    decisionStatus = 'in_progress';   // główny status sprawy
    appealStatus = 'processed';       // Odwołanie – już przetworzone
    extensionStatus = 'in_acceptance';// Przedłużenie – Edycja i podpisywanie
  }

  return {
    id: dbRecord.id,
    decisionNumber: dbRecord.decisionNumber || 'BRAK NR',
    organizer: dbRecord.organizator || 'Brak danych',
    documentDate: dbRecord.documentDate || '-',
    createdAt: createdAtDisplay,
    signedBy: dbRecord.signedBy || 'Nieznany',
    daysRemaining,
    status: decisionStatus,
    decisionText: dbRecord.decisionText ?? null,
    documents: [
      {
        id: `doc-${dbRecord.id}-appeal`,
        name: 'Odwołanie',
        type: 'PDF',
        date: dbRecord.documentDate || '-',
        size: '',
        status: appealStatus,
        filePath: dbRecord.filePath,
      },
      {
        id: `doc-${dbRecord.id}-ext`,
        name: 'Przedłużenie',
        type: 'DOC',
        date: '-',
        size: '-',
        status: extensionStatus,
      },
      {
        id: `doc-${dbRecord.id}-dec`,
        name: 'Decyzja',
        type: 'PDF',
        date: '-',
        size: '-',
        status: finalStatus,
      },
    ],
  };
};


  // --- AKCJA: klik "Przetwarzaj" na Odwołaniu ---
  const handleProcessAppeal = async (decision: DecisionRecord, doc: AttachedDocument) => {
    try {
      setProcessingDocId(doc.id);

      // 1) UTWÓRZ / ZAKTUALIZUJ DRAFT PRZEDŁUŻENIA W BAZIE
      //    – dane startowe bierzemy z Decision
      await fetch('/api/extension-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decisionId: decision.id,
          decisionNumber: decision.decisionNumber,
          organizer: decision.organizer,
          legalForm: 'Stowarzyszenie',              // na razie stała, potem możesz wpiąć z bazy
          organizerAddress: 'brak adresu (TODO)',   // to samo
          documentDate: decision.documentDate,
          decisionText: decision.decisionText ?? '',
        }),
      });

      // (opcjonalny mini–lag, żeby spinner „był widoczny")
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 2) ZAKTUALIZUJ STAN UI – STATUSY
      setData((prev) =>
        prev.map((d) => {
          if (d.id !== decision.id) return d;

          return {
            ...d,
            status: 'in_progress',
            documents: d.documents.map((existingDoc) => {
              // Odwołanie -> przetworzone
              if (existingDoc.id === doc.id) {
                return {
                  ...existingDoc,
                  status: 'processed',
                };
              }

              // Przedłużenie -> w akceptacji
              if (existingDoc.name === 'Przedłużenie') {
                return {
                  ...existingDoc,
                  status: 'in_acceptance',
                  date: new Date().toISOString().slice(0, 10),
                  size: existingDoc.size || '',
                };
              }

              return existingDoc;
            }),
          };
        })
      );
    } catch (error) {
      console.error('Nie udało się przetworzyć odwołania / utworzyć draftu', error);
      alert('Nie udało się rozpocząć generowania przedłużenia. Sprawdź logi serwera.');
    } finally {
      setProcessingDocId(null);
    }
  };



  // --- AKCJA: klik "Pobierz" przy Przedłużeniu ---
    const handleDownloadExtension = async (decision: DecisionRecord) => {
      try {
        const res = await fetch('/api/documents/extension', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ decisionId: decision.id }),
        });

        if (!res.ok) {
          console.error('Błąd generowania dokumentu przedłużenia');
          alert('Nie udało się wygenerować dokumentu. Sprawdź logi serwera.');
          return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postanowienie_przedluzenie_${decision.id}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Nie udało się pobrać przedłużenia', error);
        alert('Wystąpił błąd przy pobieraniu dokumentu.');
      }
    };


  // --- AKCJA: klik "Edytuj" przy Przedłużeniu ---
  const handleEditExtension = (decision: DecisionRecord, doc: AttachedDocument) => {
    const existingDraft = extensionDrafts[decision.id];

    const initial: ExtensionFormState = existingDraft ?? {
      decisionNumber: decision.decisionNumber,
      organizer: decision.organizer,
      legalForm: 'Stowarzyszenie',
      organizerAddress: 'brak adresu (TODO)',
      documentDate: decision.documentDate,
      decisionText: decision.decisionText ?? '',
    };

    setEditingDecisionId(decision.id);
    setEditForm(initial);
    setEditModalOpen(true);

    // Oznacz jako zaakceptowane
    setAcceptedExtensions(prev => new Set(prev).add(decision.id));
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingDecisionId(null);
    setEditForm(null);
  };

  const saveEditModal = async () => {
      if (!editingDecisionId || !editForm) {
        closeEditModal();
        return;
      }

      try {
        const res = await fetch(`/api/extension-draft`, {
          method: 'POST',  // może być PUT, ale POST = upsert, działa!
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decisionId: editingDecisionId,
            ...editForm,
          }),
        });

        if (!res.ok) {
          alert('Błąd zapisu zmian');
          return;
        }

        const saved = await res.json();

        // zapis do lokalnego state aby UI od razu pokazywał zmiany
        setExtensionDrafts((prev) => ({
          ...prev,
          [editingDecisionId]: saved,
        }));

        closeEditModal();
      } catch (err) {
        console.error('saveEditModal error', err);
        alert('Wystąpił błąd przy zapisie do bazy.');
      }
  };


  // --- AKCJE MODALU WYSYŁKI DO PODPISU ---
  const openSignModal = (decisionId: string) => {
    setSignDecisionId(decisionId);
    setAttachedFile(null);
    setSignModalOpen(true);
  };

  const closeSignModal = () => {
    setSignModalOpen(false);
    setSignDecisionId(null);
    setAttachedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleSendToSign = () => {
    if (!signDecisionId) return;

    // Symulacja wysyłki
    console.log('Wysłano do podpisu:', signDecisionId);
    if (attachedFile) {
      console.log('Z załączonym plikiem:', attachedFile.name);
    } else {
      console.log('Wersja z bazy danych');
    }

    // Oznacz jako wysłane
    setSentToSign(prev => new Set(prev).add(signDecisionId));

    closeSignModal();
  };

  // --- HELPERY STYLÓW ---
  const getTextClass = (text: string) => {
    const placeholders = ['-', 'Brak danych', 'Nieznany', 'BRAK NR'];
    return placeholders.includes(text) ? "text-gray-400 opacity-40 italic" : "text-gray-700";
  };

  const getRowClass = (row: DecisionRecord) => {
    const base = "group cursor-pointer transition-all duration-200 border-l-4";

    if (expandedId === row.id) {
      return `${base} bg-blue-50/40 border-l-blue-500`;
    }

    if (row.daysRemaining !== null) {
      if (row.daysRemaining < 5) {
        return `${base} bg-rose-50 hover:bg-rose-100 border-l-rose-300`;
      }
      if (row.daysRemaining < 10) {
        return `${base} bg-amber-50 hover:bg-amber-100 border-l-amber-300`;
      }
    }

    return `${base} hover:bg-gray-50 border-l-transparent`;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredData = data.filter(item => {
    if (statusFilter && item.status !== statusFilter) {
      return false;
    }

    if (searchTerm) {
      return (
        item.decisionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.organizer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Postępowania administracyjne</h1>
          <p className="text-gray-500 text-sm mt-1">
            Zarządzaj statusem spraw i przetwarzaj dokumenty EZD.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Szukaj sprawy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 shadow-sm cursor-pointer">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            Ładowanie danych...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200">
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">Status Spr.</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Nr Decyzji</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-52">Organizator</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Data</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Osoba</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Pozostało</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">Podgląd</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((row) => (
                  <React.Fragment key={row.id}>
                    {/* WIERSZ GŁÓWNY */}
                    <tr
                      onClick={() => toggleExpand(row.id)}
                      className={getRowClass(row)}
                    >
                      <td className="py-4 px-6">
                        <MainStatusBadge status={row.status} />
                      </td>

                      <td className="py-4 px-6">
                        <div className={`font-medium flex items-center gap-2 truncate ${getTextClass(row.decisionNumber)}`} title={row.decisionNumber}>
                          <Scale size={14} className="text-gray-400 flex-shrink-0" />
                          {row.decisionNumber}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div
                          className={`font-medium flex items-center gap-2 flex-1 whitespace-normal break-words ${getTextClass(row.organizer)}`}
                          title={row.organizer}
                        >
                          <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                          <span>{row.organizer}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-sm">
                        <div className={`flex items-center gap-2 ${getTextClass(String(row.createdAt))}`}>
                          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                          {String(row.createdAt).slice(0, 10)}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-sm">
                        <div className={`max-w-[140px] truncate ${getTextClass(row.signedBy)}`} title={row.signedBy}>
                          {row.signedBy}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-sm">
                        {row.daysRemaining !== null ? (
                          <div className={`flex items-center gap-1.5 font-semibold ${
                            row.daysRemaining < 0 ? 'text-rose-700' :
                            row.daysRemaining < 5 ? 'text-rose-600' :
                            row.daysRemaining < 10 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            <Hourglass size={14} />
                            {row.daysRemaining} dni
                          </div>
                        ) : (
                          <span className="text-gray-400 opacity-40">-</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDebugModal(row);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 shadow-sm cursor-pointer"
                        >
                          <Eye size={14} />
                          Dane
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end">
                          <button
                            className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${expandedId === row.id ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-400 hover:bg-gray-100'}`}
                          >
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* SZCZEGÓŁY */}
                    {expandedId === row.id && (
                      <tr className="bg-gray-50/30 animate-in fade-in slide-in-from-top-1">
                        <td colSpan={8} className="p-0 border-b border-gray-200 shadow-inner">
                          <div className="p-6 md:p-8">

                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                <div className="flex items-center gap-2">
                                  <FileText size={16} className="text-gray-500" />
                                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Obieg dokumentów (EZD)
                                  </h3>
                                </div>
                                <div className="hidden md:grid grid-cols-10 gap-4 w-[60%] text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                                  <div className="col-span-3">Status</div>
                                  <div className="col-span-4">Akcja</div>
                                  <div className="col-span-3">Pliki</div>
                                </div>
                              </div>

                              <div className="divide-y divide-gray-100">
                                {row.documents.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className={`flex flex-col md:flex-row items-center p-4 md:px-6 md:py-4 transition-colors gap-4 ${doc.status === 'waiting' ? 'opacity-60 bg-gray-50/50' : 'hover:bg-gray-50'}`}
                                  >
                                    <div className="flex items-center gap-4 w-full md:w-[40%]">
                                      <FileIcon type={doc.type} />
                                      <div className="min-w-0">
                                        <div className="font-semibold text-gray-800 text-sm truncate" title={doc.name}>
                                          {doc.name}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                          <span>{doc.size}</span>
                                          {doc.date !== '-' && (
                                            <>
                                              <span className="text-xs pl-6 text-gray-400">z dnia:</span>
                                              <span>{doc.date}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="w-full md:w-[60%] grid grid-cols-1 md:grid-cols-10 gap-4 items-center">
                                      <div className="md:col-span-3 flex justify-center">
                                        {renderDocStatus(doc.status)}
                                      </div>
                                      <div className="md:col-span-4 flex justify-center">
                                        {renderPrimaryAction({
                                          doc,
                                          decision: row,
                                          isProcessing: processingDocId === doc.id,
                                          onProcessAppeal: doc.name === 'Odwołanie'
                                            ? () => handleProcessAppeal(row, doc)
                                            : () => openSignModal(row.id),
                                          acceptedExtensions,
                                          sentToSign,
                                        })}
                                      </div>
                                      <div className="md:col-span-3 flex justify-center">
                                        {renderFileAction(
                                          doc,
                                          row,
                                          () => handleDownloadExtension(row),
                                          () => handleEditExtension(row, doc),
                                          sentToSign
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PODGLĄDU STRUKTURY DANYCH */}
      {debugModalOpen && debugRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDebugModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                  <FileText size={18} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Szczegóły sprawy i struktura danych
                  </h2>
                  <p className="text-xs text-slate-700">
                    ID: <span className="font-mono">{debugRecord.id}</span> • Decyzja: {debugRecord.decisionNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDebugModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs text-slate-700">
                Poniżej widzisz dane po transformacji do modelu UI <span className="font-mono">DecisionRecord</span>. Przydatne do debugowania i dalszego rozwoju widoków.
              </p>
            </div>

            <div className="px-6 py-4 overflow-auto bg-gray-900 text-gray-50 text-xs font-mono flex-1">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(debugRecord, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeDebugModal}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDYCJI DOKUMENTU PRZEDŁUŻENIA */}
      {editModalOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeEditModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                  <FileText size={18} className="text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Edycja treści postanowienia o przedłużeniu
                  </h2>
                  <p className="text-xs text-slate-700">
                    Formularz składa się z pól, z których generowany jest dokument DOCX.
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4 overflow-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Numer decyzji Marszałka
                  </label>
                  <input
                    type="text"
                    value={editForm.decisionNumber}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, decisionNumber: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Forma prawna
                  </label>
                  <input
                    type="text"
                    value={editForm.legalForm}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, legalForm: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Organizator
                  </label>
                  <input
                    type="text"
                    value={editForm.organizer}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, organizer: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Adres siedziby organizatora
                  </label>
                  <input
                    type="text"
                    value={editForm.organizerAddress}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, organizerAddress: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data decyzji Marszałka (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    value={editForm.documentDate}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, documentDate: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Uzasadnienie (treść decyzji / opis sprawy)
                </label>
                <textarea
                  value={editForm.decisionText}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, decisionText: e.target.value } : prev
                    )
                  }
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Ta treść zostanie wstawiona w sekcji <span className="font-semibold">UZASADNIENIE</span> w dokumencie DOCX.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] text-gray-400">
                Zmiany zapisują się tylko w tej sesji i będą użyte przy kolejnym kliknięciu <span className="font-semibold">Pobierz</span>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  onClick={saveEditModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
                >
                  Zapisz zmiany
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WYSYŁKI DO PODPISU */}
      {signModalOpen && signDecisionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeSignModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
                  <Send size={18} className="text-purple-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Wysyłka dokumentu do podpisu
                  </h2>
                  <p className="text-xs text-slate-700">
                    Wybierz opcję wysyłki dokumentu przedłużenia
                  </p>
                </div>
              </div>
              <button
                onClick={closeSignModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="space-y-3">
                <button
                  onClick={handleSendToSign}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} className="text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-800 text-sm">
                      Wyślij wersję z bazy danych
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Użyj aktualnie zapisanej wersji dokumentu
                    </div>
                  </div>
                  <Send size={18} className="text-purple-600" />
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-500">lub</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
                  <label className="flex items-center gap-4 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Upload size={20} className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 text-sm">
                        Załącz własny plik
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {attachedFile ? attachedFile.name : 'Wybierz plik .docx lub .pdf'}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".docx,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  {attachedFile && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={handleSendToSign}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <Send size={16} />
                        Wyślij załączony plik
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeSignModal}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}