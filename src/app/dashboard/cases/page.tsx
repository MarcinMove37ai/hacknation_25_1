"use client"

import React, { useState, useEffect } from 'react';
import { getDecisionsAction } from '@/app/actions';
import {
  FileText, ChevronDown, Search, Filter, Download, Clock,
  CheckCircle, AlertCircle, Calendar, Scale, Play, Send, Upload, File, Eye,
  Building2, Hourglass
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
  documentDate: string;   // ZOSTAJE – dalej możesz używać
  createdAt: string;      // NOWE pole do kolumny
  signedBy: string;
  daysRemaining: number | null;
  status: DecisionStatus;
  documents: AttachedDocument[];
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
    case 'in_acceptance': return <span className={`${baseClass} text-amber-600 bg-amber-50 border-amber-100`}>W akceptacji</span>;
    case 'waiting': return <span className={`${baseClass} text-gray-400 bg-gray-50 border-gray-200`}>Oczekuje</span>;
    default: return null;
  }
};

const renderPrimaryAction = (status: DocStatus) => {
  const btnBase = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm w-full";
  switch (status) {
    case 'new':
      return (
        <button className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md`}>
          <Play size={16} fill="currentColor" />
          Przetwarzaj
        </button>
      );
    case 'processed':
      return (
        <button className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md`}>
          <Send size={16} />
          Do akceptacji
        </button>
      );
    case 'in_acceptance':
      return (
        <button className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600 hover:shadow-md`}>
          <Send size={16} />
          Do akceptacji
        </button>
      );
    case 'waiting': return <div className="h-9 w-full"></div>;
    default: return null;
  }
};

/**
 * Akcje pliku – TERAZ dostaje całego doca, dzięki czemu mamy dostęp do filePath.
 */
const renderFileAction = (doc: AttachedDocument) => {
  const { status, filePath } = doc;

  const btnBase = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full";
  const btnSecondary = `${btnBase} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`;
  const btnDashed = `${btnBase} bg-white text-gray-700 border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50`;

  switch (status) {
    case 'new':
      return (
        <a
          href={doc.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={btnSecondary}
        >
          <Eye size={16} />
          Podgląd
        </a>
      );
    case 'processed':
      // Jeśli nie ma ścieżki do pliku – pokazujemy info, że nie ma czego pobrać
      if (!filePath) {
        return (
          <span className="text-xs text-gray-400 italic">
            Brak pliku do pobrania
          </span>
        );
      }

      // Jeśli jest ścieżka – podpinamy ją jako link
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

  useEffect(() => {
      async function loadData() {
        try {
          const result = await getDecisionsAction();

          // 👇 TU zobaczysz pełny rekord z bazy (wszystkie kolumny modelu Decision)
          console.log('RAW decisions from DB:', result.data);

          if (result.success && result.data) {
            // @ts-ignore
            const mappedData = result.data.map((dbRecord: any) => transformToUiModel(dbRecord));
            console.log('Mapped decisions data (DecisionRecord[]):', mappedData);

            mappedData.sort((a, b) => {
              if (a.daysRemaining === null) return 1;
              if (b.daysRemaining === null) return -1;
              return a.daysRemaining - b.daysRemaining;
            });

            setData(mappedData);
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

  let daysRemaining = null;

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

  const createdAtDisplay = dbRecord.createdAt
    ? new Date(dbRecord.createdAt).toISOString().slice(0, 10) // np. 2025-12-07
    : '-';

  return {
    id: dbRecord.id,
    decisionNumber: dbRecord.decisionNumber || 'BRAK NR',
    organizer: dbRecord.organizator || 'Brak danych',
    documentDate: dbRecord.documentDate || '-', // ZOSTAJE
    createdAt: createdAtDisplay,                // NOWE
    signedBy: dbRecord.signedBy || 'Nieznany',
    daysRemaining,
    status: (dbRecord.status as DecisionStatus) ?? 'new',
    documents: [
      {
        id: `doc-${dbRecord.id}-appeal`,
        name: 'Odwołanie',
        type: 'PDF',
        date: dbRecord.documentDate || '-',
        size: '',
        status: 'new',
        filePath: dbRecord.filePath
      },
      {
        id: `doc-${dbRecord.id}-ext`,
        name: 'Przedłużenie',
        type: 'DOC',
        date: '-',
        size: '-',
        status: 'waiting',
      },
      {
        id: `doc-${dbRecord.id}-dec`,
        name: 'Decyzja',
        type: 'PDF',
        date: '-',
        size: '-',
        status: 'waiting',
      }
    ]
  };
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

  const filteredData = data.filter(item =>
    item.decisionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.organizer.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              placeholder="Szukaj (nr decyzji, organizator)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 shadow-sm">
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

                      {/* Data (createdAt) */}
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
                        <div className="flex justify-end">
                          <button className={`p-2 rounded-lg transition-all duration-200 ${expandedId === row.id ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-400 hover:bg-gray-100'}`}>
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* SZCZEGÓŁY */}
                    {expandedId === row.id && (
                      <tr className="bg-gray-50/30 animate-in fade-in slide-in-from-top-1">
                        <td colSpan={7} className="p-0 border-b border-gray-200 shadow-inner">
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
                                              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
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
                                        {renderPrimaryAction(doc.status)}
                                      </div>
                                      <div className="md:col-span-3 flex justify-center">
                                        {renderFileAction(doc)}
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
    </div>
  );
}