"use client";

import React, { useState, useRef } from 'react';
import { FileText, CheckCircle, X, Loader2, HardDrive, CloudUpload, ArrowRight, AlertCircle } from 'lucide-react';

export default function EzdSimulatorPage() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [txtFileName, setTxtFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending file to OCR...');
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Error during upload');
      }

      console.log('OCR completed:', uploadData);

      if (!uploadData.ocr?.txtFile) {
        throw new Error('Failed to generate TXT file');
      }

      setTxtFileName(uploadData.ocr.txtFile);
      setUploadStatus('success');

    } catch (error) {
      console.error('Error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
    setTxtFileName(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const openFileExplorer = () => {
    inputRef.current?.click();
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-start pt-4 md:pt-16 bg-gray-50/50 p-2 sm:p-6 font-sans animate-in fade-in duration-500">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

        <div className="bg-white border-b border-gray-100 p-4 sm:p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-600 to-red-800"></div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-red-50 text-red-600 shadow-sm flex-shrink-0">
              <HardDrive className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                AI powered OCR App
              </h1>
              <p className="text-gray-500 font-medium text-xs sm:text-sm mt-0.5">
                Turn any PDF or Image file into a plain text TXT document
              </p>
            </div>
          </div>

          <div className="hidden md:block text-right">
            <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">system status</div>
            <div className="flex items-center justify-end gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm font-semibold text-gray-700">Online</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-12 space-y-6 md:space-y-8">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">
              Upload new file
            </h2>
            <p className="text-gray-500">
              Upload a file for AI OCR processing
            </p>
          </div>

          {!uploadStatus.includes('success') && (
            <div
              className={`
                relative flex flex-row items-center w-full min-h-[140px] sm:min-h-[180px] px-4 sm:px-8 py-4 sm:py-6
                rounded-2xl sm:rounded-[2rem] border-[3px] border-dashed transition-all duration-300 ease-out cursor-pointer group overflow-hidden
                ${dragActive
                  ? 'border-red-500 bg-red-50/40 scale-[1.01] shadow-inner'
                  : uploadStatus === 'error'
                    ? 'border-red-300 bg-red-50/10'
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
                accept=".pdf,.png,.jpg,.jpeg"
              />

              {file ? (
                <div className="flex flex-row items-center justify-between w-full animate-in slide-in-from-left-2 duration-300 z-10">
                  <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
                    </div>

                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-gray-900 font-bold text-sm sm:text-lg break-words text-left leading-tight">
                        {file.name}
                      </p>

                      {uploadStatus === 'error' ? (
                        <p className="text-red-500 font-medium text-sm text-left mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {errorMessage || 'Upload error'}
                        </p>
                      ) : (
                        <p className="text-gray-500 font-medium text-sm text-left mt-1">
                          File is ready to go • {(file.size / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                  </div>

                  {uploadStatus !== 'uploading' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(); }}
                      className="p-3 bg-white border border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm group/btn flex-shrink-0 cursor-pointer"
                    >
                      <X size={20} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full pointer-events-none z-10">
                  <div className={`
                    w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm border
                    ${dragActive ? 'bg-white text-red-600 border-red-100' : 'bg-white text-gray-400 border-gray-100 group-hover:scale-105 group-hover:text-red-500'}
                  `}>
                    <CloudUpload className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
                    <p className="text-gray-800 font-bold text-base sm:text-xl group-hover:text-red-600 transition-colors">
                      Drag and drop file here
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">
                        or click to browse local files
                      </p>
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] sm:text-xs text-gray-400 font-mono whitespace-nowrap">PDF, PNG, JPG</span>
                    </div>
                  </div>
                  <div className="hidden sm:block ml-auto text-gray-300 group-hover:text-red-400 transition-colors">
                    <ArrowRight size={24} />
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadStatus === 'success' && txtFileName && (
            <div className="flex flex-col gap-4 p-4 sm:p-8 w-full bg-green-50/50 rounded-2xl sm:rounded-[2rem] border border-green-100 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm border-4 border-white flex-shrink-0">
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">OCR completed!</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1">
                    File <span className="font-semibold text-gray-900">{file?.name}</span> has been processed.
                  </p>
                </div>
              </div>

              <a
                href={`/api/assets/${txtFileName}`}
                download
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-center hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg flex items-center justify-center gap-3 cursor-pointer"
              >
                <FileText size={20} />
                Download TXT file
              </a>

              <button
                onClick={removeFile}
                className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold cursor-pointer"
              >
                Process another file
              </button>
            </div>
          )}

          {uploadStatus !== 'success' && (
            <div className="pt-2">
              <button
                onClick={(!file || uploadStatus === 'uploading') ? undefined : handleUpload}
                className={`
                  relative w-full py-3 sm:py-5 rounded-2xl font-bold text-white shadow-xl transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg
                  ${!file
                    ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700 shadow-none'
                    : uploadStatus === 'uploading'
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 cursor-wait shadow-lg'
                      : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 hover:shadow-red-200/50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                  }
                `}
              >
                {!file ? (
                  <span>Waiting for file</span>
                ) : uploadStatus === 'uploading' ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : uploadStatus === 'error' ? (
                  <>
                    <span>Try again</span>
                    <ArrowRight size={20} />
                  </>
                ) : (
                  <>
                    <span>Start OCR processing</span>
                    <ArrowRight size={20} className="opacity-100 translate-x-0 transition-all" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 sm:px-8 py-3 sm:py-5 border-t border-gray-100 flex justify-between items-center text-[10px] md:text-xs text-gray-400 font-mono tracking-wider uppercase">
          <div className="flex items-center gap-2">
            SECURE_CONNECTION: ENCRYPTED
          </div>
          <span>v.2.0.4-PUW</span>
        </div>
      </div>
    </div>
  );
}