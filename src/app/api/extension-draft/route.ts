// src/app/api/extension-draft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // jeśli masz inną ścieżkę – podmień

// GET /api/extension-draft?decisionId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const decisionId = searchParams.get('decisionId');

    if (!decisionId) {
      return NextResponse.json(
        { error: 'Parametr decisionId jest wymagany' },
        { status: 400 },
      );
    }

    const draft = await prisma.extensionDraft.findUnique({
      where: { decisionId },
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'Brak zapisanego projektu przedłużenia' },
        { status: 404 },
      );
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('GET /api/extension-draft error', error);
    return NextResponse.json(
      { error: 'Błąd serwera przy pobieraniu projektu przedłużenia' },
      { status: 500 },
    );
  }
}

// POST /api/extension-draft  (upsert)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      decisionId,
      decisionNumber,
      organizer,
      legalForm,
      organizerAddress,
      documentDate,
      decisionText,
    } = body as {
      decisionId?: string;
      decisionNumber?: string;
      organizer?: string;
      legalForm?: string;
      organizerAddress?: string;
      documentDate?: string;
      decisionText?: string;
    };

    if (!decisionId) {
      return NextResponse.json(
        { error: 'decisionId jest wymagane' },
        { status: 400 },
      );
    }

    const draft = await prisma.extensionDraft.upsert({
      where: { decisionId },
      update: {
        decisionNumber: decisionNumber ?? '',
        organizer: organizer ?? '',
        legalForm: legalForm ?? '',
        organizerAddress: organizerAddress ?? '',
        documentDate: documentDate ?? '',
        decisionText: decisionText ?? '',
      },
      create: {
        decisionId,
        decisionNumber: decisionNumber ?? '',
        organizer: organizer ?? '',
        legalForm: legalForm ?? '',
        organizerAddress: organizerAddress ?? '',
        documentDate: documentDate ?? '',
        decisionText: decisionText ?? '',
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('POST /api/extension-draft error', error);
    return NextResponse.json(
      { error: 'Błąd serwera przy zapisie projektu przedłużenia' },
      { status: 500 },
    );
  }
}
