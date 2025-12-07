"use client"

import React from 'react';
import { Scale } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-4xl w-full mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-12 h-12 bg-red-600 rounded flex items-center justify-center">
          <Scale className="w-7 h-7 text-white" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HACKNATION</h1>
          <p className="text-sm text-gray-500">Ministerstwo Sportu i Turystyki</p>
        </div>
      </div>

      {/* Main content */}
      <div className="border-l-4 border-red-600 pl-8 py-4">
        <div className="inline-block px-3 py-1 bg-red-50 border border-red-200 rounded text-sm text-red-600 font-medium mb-6">
          W trakcie przygotowania
        </div>

        <p className="text-3xl text-gray-800 leading-relaxed">
          Oczekuję na dostarczenie baz <span className="font-bold text-red-600">300 wydanych orzeczeń</span> abyś mógł z nimi konwersować na czacie oraz swobodnie przeglądać oraz filtrować.
        </p>
      </div>
    </div>
  );
}