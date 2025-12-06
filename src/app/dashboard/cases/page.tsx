"use client"

import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Scale,
  Play,
  Send,
  Upload,
  File
} from 'lucide-react';

// --- TYPY DANYCH ---

type DecisionStatus = 'in_progress' | 'closed' | 'pending';
type DocStatus = 'new' | 'processed' | 'in_acceptance';

interface AttachedDocument {
  id: string;
  name: string;
  type: 'PDF' | 'DOC';
  date: string;
  size: string;
  status: DocStatus;
}

interface DecisionRecord {
  id: string;
  decisionNumber: string;
  documentDate: string;
  signedBy: string;
  status: DecisionStatus;
  documents: AttachedDocument[];
}

// --- DANE PRZYKŁADOWE ---

const MOCK_DATA: DecisionRecord[] = [
  {
    id: '1',
    decisionNumber: 'DEC/2024/05/12',
    documentDate: '2024-05-12',
    signedBy: 'Dr. Anna Kowalska',
    status: 'in_progress',
    documents: [
      {
        id: 'd1',
        name: 'Odwołanie',
        type: 'PDF',
        date: '2024-05-10',
        size: '2.4 MB',
        status: 'new'
      },
      {
        id: 'd2',
        name: 'Przedłużenie',
        type: 'DOC',
        date: '2024-05-11',
        size: '1.1 MB',
        status: 'processed'
      },
      {
        id: 'd3',
        name: 'Decyzja',
        type: 'PDF',
        date: '2024-05-12',
        size: '0.5 MB',
        status: 'in_acceptance'
      },
    ]
  },
  {
    id: '2',
    decisionNumber: 'DEC/2024/04/01',
    documentDate: '2024-04-01',
    signedBy: 'Mgr inż. Jan Nowak',
    status: 'closed',
    documents: []
  },
];

// --- KOMPONENTY UI ---

const MainStatusBadge = ({ status }: { status: DecisionStatus }) => {
  const config = {
    in_progress: { label: 'W toku', color: 'bg-blue-100 text-blue-700', icon: Clock },
    closed: { label: 'Zakończone', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    pending: { label: 'Do wyjaśnienia', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  };
  const { label, color, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

const FileIcon = ({ type }: { type: 'PDF' | 'DOC' }) => {
  if (type === 'PDF') {
    return (
      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
        <FileText size={20} />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
      <File size={20} />
    </div>
  );
};

// --- LOGIKA KOLUMN (RENDEROWANIE) ---

// 1. Kolumna STATUS
const renderDocStatus = (status: DocStatus) => {
  const baseClass = "text-xs font-bold px-3 py-1.5 rounded border text-center w-full block";
  switch (status) {
    case 'new':
      return <span className={`${baseClass} text-blue-600 bg-blue-50 border-blue-100`}>Nowy</span>;
    case 'processed':
      return <span className={`${baseClass} text-green-600 bg-green-50 border-green-100`}>Przetworzony</span>;
    case 'in_acceptance':
      return <span className={`${baseClass} text-amber-600 bg-amber-50 border-amber-100`}>W akceptacji</span>;
    default: return null;
  }
};

// 2. Kolumna AKCJA (Główny przycisk)
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
    default: return null;
  }
};

// 3. Kolumna PLIKI (Dodaj / Pobierz / Puste)
const renderFileAction = (status: DocStatus) => {
  const btnBase = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full";
  const btnSecondary = `${btnBase} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`;
  const btnDashed = `${btnBase} bg-white text-gray-700 border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50`;

  switch (status) {
    case 'new':
      // Puste miejsce, ale zachowuje wysokość
      return <div className="h-9 w-full"></div>;
    case 'processed':
      return (
        <button className={btnSecondary}>
          <Download size={16} />
          Pobierz
        </button>
      );
    case 'in_acceptance':
      return (
        <button className={btnDashed}>
          <Upload size={16} />
          Dodaj plik
        </button>
      );
    default: return null;
  }
};

// --- GŁÓWNY KOMPONENT ---

export default function SciezkaPrawnaPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredData = MOCK_DATA.filter(item =>
    item.decisionNumber.toLowerCase().includes(searchTerm.toLowerCase())
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
              placeholder="Szukaj..."
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Status Spr.</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nr Decyzji</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Osoba</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((row) => (
                <React.Fragment key={row.id}>
                  {/* WIERSZ GŁÓWNY */}
                  <tr
                    onClick={() => toggleExpand(row.id)}
                    className={`
                      group cursor-pointer transition-all duration-200
                      ${expandedId === row.id ? 'bg-blue-50/40 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
                    `}
                  >
                    <td className="py-4 px-6">
                      <MainStatusBadge status={row.status} />
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-700 flex items-center gap-2">
                        <Scale size={14} className="text-gray-400" />
                        {row.decisionNumber}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {row.documentDate}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-sm">
                      {row.signedBy}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end">
                        <button className={`p-2 rounded-lg transition-all duration-200 ${expandedId === row.id ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-400 hover:bg-gray-100'}`}>
                          <ChevronDown size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* SZCZEGÓŁY (GRID DOKUMENTÓW) */}
                  {expandedId === row.id && (
                    <tr className="bg-gray-50/30 animate-in fade-in slide-in-from-top-1">
                      <td colSpan={5} className="p-0 border-b border-gray-200 shadow-inner">
                        <div className="p-6 md:p-8">

                          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            {/* Header sekcji */}
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                               <div className="flex items-center gap-2">
                                  <FileText size={16} className="text-gray-500" />
                                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Obieg dokumentów (EZD)
                                  </h3>
                               </div>

                               {/* Nagłówki kolumn dla czytelności (tylko desktop) */}
                               <div className="hidden md:grid grid-cols-10 gap-4 w-[60%] text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                                  <div className="col-span-3">Status</div>
                                  <div className="col-span-4">Akcja</div>
                                  <div className="col-span-3">Pliki</div>
                               </div>
                            </div>

                            {/* Lista Dokumentów - GRID */}
                            <div className="divide-y divide-gray-100">
                              {row.documents.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="flex flex-col md:flex-row items-center p-4 md:px-6 md:py-4 hover:bg-gray-50 transition-colors gap-4"
                                >
                                  {/* LEWA STRONA (40% szerokości) - Informacje */}
                                  <div className="flex items-center gap-4 w-full md:w-[40%]">
                                    <FileIcon type={doc.type} />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-gray-800 text-sm truncate" title={doc.name}>
                                        {doc.name}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                        <span>{doc.size}</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span>{doc.date}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* PRAWA STRONA (60% szerokości) - Siatka 3 kolumn */}
                                  <div className="w-full md:w-[60%] grid grid-cols-1 md:grid-cols-10 gap-4 items-center">

                                    {/* 1. Kolumna STATUS (3/10) */}
                                    <div className="md:col-span-3 flex justify-center">
                                       {renderDocStatus(doc.status)}
                                    </div>

                                    {/* 2. Kolumna AKCJA (4/10) */}
                                    <div className="md:col-span-4 flex justify-center">
                                       {renderPrimaryAction(doc.status)}
                                    </div>

                                    {/* 3. Kolumna PLIKI (3/10) */}
                                    <div className="md:col-span-3 flex justify-center">
                                       {renderFileAction(doc.status)}
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
      </div>
    </div>
  );
}