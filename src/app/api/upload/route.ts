// D:\hacknation_25\hacknation_25\src\app\api\upload\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// --- DODAJ TĘ FUNKCJĘ ---
function normalizeFilename(filename: string): string {
  const extension = path.extname(filename);
  const nameWithoutExt = path.basename(filename, extension);

  const charMap: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };

  const normalizedName = nameWithoutExt
    .split('')
    .map(char => charMap[char] || char)
    .join('')
    .replace(/\s+/g, '_')             // Spacje na _
    .replace(/[^a-zA-Z0-9._-]/g, ''); // Usuń resztę dziwnych znaków

  return `${normalizedName}${extension}`;
}
// ------------------------

// Ścieżka do volume na Railway - dostosuj do swojej konfiguracji
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Brak pliku w żądaniu' },
        { status: 400 }
      );
    }

    // Walidacja typu pliku
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Niedozwolony typ pliku. Akceptowane: PDF, DOC, DOCX, TXT' },
        { status: 400 }
      );
    }

    // Walidacja rozmiaru (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Plik jest za duży. Maksymalny rozmiar: 10MB' },
        { status: 400 }
      );
    }

    // Utworzenie katalogu jeśli nie istnieje
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generowanie bezpiecznej nazwy pliku z timestampem
    const timestamp = Date.now();
    // Używamy nowej funkcji normalizującej
    const cleanName = normalizeFilename(file.name);
    const fileName = `${timestamp}_${cleanName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Konwersja pliku do bufora i zapis
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Wysłanie pliku do Python OCR API (tylko dla PDF)
    let ocrResult = null;
    if (file.type === 'application/pdf') {
      try {
        // URL do Python OCR API - ustaw w zmiennych środowiskowych Railway
        const pythonApiUrl = process.env.PYTHON_OCR_API_URL || 'http://localhost:8000';

        // Utworzenie FormData z plikiem
        const ocrFormData = new FormData();
        const fileBlob = new Blob([buffer], { type: file.type });
        ocrFormData.append('file', fileBlob, file.name);

        console.log(`Wysyłanie pliku do OCR API: ${pythonApiUrl}/ocr`);

        // Wysłanie do Python API
        const ocrResponse = await fetch(`${pythonApiUrl}/ocr`, {
          method: 'POST',
          body: ocrFormData,
        });

        if (ocrResponse.ok) {
          ocrResult = await ocrResponse.json();
          console.log('✅ OCR zakończone pomyślnie');
          console.log('📄 Rozpoznany tekst:', ocrResult.text);
        } else {
          const errorText = await ocrResponse.text();
          console.error('❌ Błąd OCR:', errorText);
          ocrResult = { error: errorText };
        }
      } catch (ocrError) {
        console.error('❌ Nie udało się połączyć z OCR API:', ocrError);
        ocrResult = {
          error: 'Nie udało się połączyć z OCR API',
          details: ocrError instanceof Error ? ocrError.message : 'Nieznany błąd'
        };
      }
    }

    // Zwrócenie informacji o zapisanym pliku + wyniki OCR
    return NextResponse.json({
      success: true,
      message: 'Plik został pomyślnie przesłany',
      file: {
        name: file.name,
        savedAs: fileName,
        size: file.size,
        type: file.type,
        path: filePath,
        uploadedAt: new Date().toISOString()
      },
      ocr: ocrResult // Wyniki OCR jeśli PDF (null dla innych typów)
    }, { status: 200 });

  } catch (error) {
    console.error('Błąd podczas przesyłania pliku:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas przesyłania pliku',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint do listowania plików
export async function GET(request: NextRequest) {
  try {
    const { readdir, stat } = await import('fs/promises');

    if (!existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ files: [] });
    }

    const files = await readdir(UPLOAD_DIR);
    const fileDetails = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(UPLOAD_DIR, fileName);
        const stats = await stat(filePath);
        return {
          name: fileName,
          size: stats.size,
          uploadedAt: stats.mtime,
          path: filePath
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: fileDetails.length,
      files: fileDetails
    });

  } catch (error) {
    console.error('Błąd podczas pobierania listy plików:', error);
    return NextResponse.json(
      { error: 'Błąd podczas pobierania listy plików' },
      { status: 500 }
    );
  }
}