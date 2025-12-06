import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

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
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Konwersja pliku do bufora i zapis
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Zwrócenie informacji o zapisanym pliku
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
      }
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