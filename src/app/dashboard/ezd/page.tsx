"use client";

import React, { useState, useRef } from 'react';
import { FileText, CheckCircle, X, Loader2, HardDrive, CloudUpload, ArrowRight, Clock } from 'lucide-react';

export default function EzdSimulatorPage() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Obsługa przeciągania
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Obsługa upuszczenia pliku
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setUploadStatus('idle');
    }
  };

  // Obsługa wyboru z eksploratora
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  // Symulacja procesu
  const handleUpload = () => {
    if (!file) return;
    setUploadStatus('uploading');

    // Symulacja procesu (2 sekundy)
    setTimeout(() => {
      setUploadStatus('success');
    }, 2000);
  };

  const removeFile = () => {
    setFile(null);
    setUploadStatus('idle');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const openFileExplorer = () => {
    inputRef.current?.click();
  };

  return (
    // ZMIANA: justify-center -> justify-start oraz dodane pt-10 (przesunięcie w górę)
    <div className="min-h-full flex flex-col items-center justify-start pt-10 md:pt-16 bg-gray-50/50 p-6 font-sans animate-in fade-in duration-500">

      {/* --- Karta Główna (Szeroka) --- */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

        {/* Nagłówek Karty */}
        <div className="bg-white border-b border-gray-100 p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-600 to-red-800"></div>

          <div className="flex items-center gap-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-red-600 shadow-sm flex-shrink-0">
              <HardDrive size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Symulator EZD PUW
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                System Elektronicznego Zarządzania Dokumentacją
              </p>
            </div>
          </div>

          <div className="hidden md:block text-right">
             <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Status systemu</div>
             <div className="flex items-center justify-end gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-semibold text-gray-700">Online</span>
             </div>
          </div>
        </div>

        {/* Treść / Obszar roboczy */}
        <div className="p-8 md:p-12 space-y-8">

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-800">
              Wprowadzanie nowej decyzji
            </h2>
            <p className="text-gray-500">
              Dodaj plik decyzji do przetworzenia przez algorytmy AI.
            </p>
          </div>

          {/* --- POZIOMY OBSZAR DRAG & DROP --- */}
          {!uploadStatus.includes('success') && (
            <div
              className={`
                relative flex flex-row items-center w-full min-h-[180px] px-8 py-6
                rounded-[2rem] border-[3px] border-dashed transition-all duration-300 ease-out cursor-pointer group overflow-hidden
                ${dragActive
                  ? 'border-red-500 bg-red-50/40 scale-[1.01] shadow-inner'
                  : file
                    ? 'border-blue-300 bg-blue-50/20'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                }
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={openFileExplorer}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                accept=".pdf,.doc,.docx,.txt"
              />

              {file ? (
                // Widok wybranego pliku (Z POPRAWKĄ ZAWIJANIA TEKSTU)
                <div className="flex flex-row items-center justify-between w-full animate-in slide-in-from-left-2 duration-300 z-10">
                  <div className="flex items-center gap-6 min-w-0 flex-1"> {/* Dodano min-w-0 i flex-1 */}

                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <FileText size={32} strokeWidth={1.5} />
                    </div>

                    <div className="min-w-0 flex-1 pr-4"> {/* Kontener tekstu z flex-1 */}
                      <p className="text-gray-900 font-bold text-lg break-words text-left leading-tight"> {/* break-words zawija tekst */}
                        {file.name}
                      </p>
                      <p className="text-gray-500 font-medium text-sm text-left mt-1">
                        Gotowy do wysłania • {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>

                  </div>

                  {uploadStatus === 'idle' && (
                     <button
                       onClick={(e) => { e.stopPropagation(); removeFile(); }}
                       className="p-3 bg-white border border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm group/btn flex-shrink-0"
                     >
                       <X size={20} className="group-hover/btn:scale-110 transition-transform" />
                     </button>
                  )}
                </div>
              ) : (
                // Widok domyślny (pusty)
                <div className="flex flex-row items-center gap-8 w-full pointer-events-none z-10">

                  {/* Ikona */}
                  <div className={`
                    w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm border
                    ${dragActive ? 'bg-white text-red-600 border-red-100' : 'bg-white text-gray-400 border-gray-100 group-hover:scale-105 group-hover:text-red-500'}
                  `}>
                    <CloudUpload size={32} strokeWidth={2} />
                  </div>

                  {/* Teksty */}
                  <div className="flex flex-col items-start text-left space-y-1">
                    <p className="text-gray-800 font-bold text-xl group-hover:text-red-600 transition-colors">
                      Przeciągnij i upuść plik tutaj
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-400 text-sm font-medium">
                        lub kliknij, aby przeglądać pliki
                      </p>
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] text-gray-400 font-mono">PDF, DOCX</span>
                    </div>
                  </div>

                  <div className="ml-auto text-gray-300 group-hover:text-red-400 transition-colors">
                     <ArrowRight size={24} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ekran Sukcesu */}
          {uploadStatus === 'success' && (
            <div className="flex flex-row items-center justify-between p-8 w-full bg-green-50/50 rounded-[2rem] border border-green-100 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm border-4 border-white flex-shrink-0">
                  <CheckCircle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Przesłano pomyślnie!</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Plik <span className="font-semibold text-gray-900">{file?.name}</span> został dodany do kolejki.
                  </p>
                </div>
              </div>

              <button
                onClick={removeFile}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm font-semibold text-sm whitespace-nowrap"
              >
                Wgraj kolejny
              </button>
            </div>
          )}

          {/* Przycisk Akcji */}
          {uploadStatus !== 'success' && (
            <div className="pt-2">
              <button
                disabled={!file || uploadStatus === 'uploading'}
                onClick={handleUpload}
                className={`
                  relative w-full py-5 rounded-2xl font-bold text-white shadow-xl transition-all duration-300 flex items-center justify-center gap-3 text-lg
                  ${!file
                    ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700 shadow-none' // ZMIANA: Ciemny szary styl gdy brak pliku
                    : uploadStatus === 'uploading'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                      : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 hover:shadow-red-200/50 hover:-translate-y-0.5 active:translate-y-0'
                  }
                `}
              >
                {/* ZMIANA: Logika wyświetlania tekstu */}
                {!file ? (
                   <>
                     <span>Oczekuję na plik</span>
                   </>
                ) : uploadStatus === 'uploading' ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <span>Przetwarzanie dokumentu...</span>
                  </>
                ) : (
                  <>
                    <span>Rozpocznij procesowanie</span>
                    <ArrowRight size={20} className="opacity-100 translate-x-0 transition-all" />
                  </>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Footer karty */}
        <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex justify-between items-center text-[10px] md:text-xs text-gray-400 font-mono tracking-wider uppercase">
          <div className="flex items-center gap-2">
            SECURE_CONNECTION: ENCRYPTED
          </div>
          <span>v.2.0.4-PUW</span>
        </div>
      </div>
    </div>
  );
}