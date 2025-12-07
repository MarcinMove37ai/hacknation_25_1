//D:\hacknation_25\hacknation_25\src\app\api\decisions\process\route.ts
// ✅ ULEPSZONA WERSJA Z DEBUGOWANIEM
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import path from 'path';

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
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  return `${normalizedName}${extension}`;
}

interface AnthropicResponse {
  content: Array<{ text: string; type: string; }>;
  id: string;
  model: string;
  role: string;
  type: string;
}

interface DecisionData {
  documentDate: string;
  decisionNumber: string;
  banYears: number;
  legalBasisKpa: string;
  legalBasisUitput: string;
  appealDays: number;
  appealCourt: string;
  signedBy: string;
  filePath: string;
  status: string;
  decisionText: string;
  organizator: string;
}

async function callAnthropicAPI(apiKey: string, prompt: string, model: string): Promise<AnthropicResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Błąd API Anthropic:', errorData);
    throw new Error(`API Anthropic error (${response.status}): ${JSON.stringify(errorData)}`);
  }
  return response.json();
}

function parseJSONFromResponse(responseText: string): DecisionData {
  try {
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.log('Parsowanie bezpośrednie nieudane, szukam bloku markdown...');
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    } else {
      throw new Error('Nie udało się wyodrębnić poprawnego JSON z odpowiedzi AI');
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentText, fileName } = body;

    // 🔍 DEBUG - Start procesu
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 START PRZETWARZANIA DECYZJI');
    console.log('═══════════════════════════════════════════════');

    if (!documentText) {
      console.error('❌ Brak tekstu dokumentu w request body');
      return NextResponse.json({ error: 'Brak tekstu dokumentu.' }, { status: 400 });
    }

    // 🔍 DEBUG - Dane wejściowe
    console.log('📥 Dane wejściowe:');
    console.log('  - fileName z requestu:', fileName || '❌ BRAK');
    console.log('  - Długość tekstu:', documentText.length, 'znaków');

    const AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-5';
    console.log('🤖 Model AI:', AI_MODEL);

    const timestamp = Date.now();
    const prompt = `Jesteś ekspertem od analizy dokumentów prawnych. Przeanalizuj poniższy dokument odwołania.
Wyciągnij kluczowe informacje i zwróć JSON.

Oczekiwany format JSON:
{
  "documentDate": "YYYY-MM-DD",
  "decisionNumber": "Numer decyzji",
  "banYears": 3,
  "legalBasisKpa": "Podstawa KPA",
  "legalBasisUitput": "Podstawa Ustawa",
  "appealDays": 30,
  "appealCourt": "Organ odwoławczy",
  "signedBy": "Podpisany przez",
  "filePath": "${fileName || 'unknown.pdf'}",
  "status": "new",
  "organizator": "KrótkaNazwa (mock)",
  "decisionText": "Treść merytoryczna"
}

INSTRUKCJE:
1. "organizator": wymyśl LOSOWĄ, KRÓTKĄ (1-3 słowa) nazwę organizacji sportowej z dopiskiem "(mock)".
   WAŻNE: Za każdym razem generuj RÓŻNĄ nazwę! Timestamp: ${timestamp}
   Przykłady: "Olimp Gdańsk (mock)", "Siła Wrocław (mock)", "Tiger Team (mock)"
2. "decisionText": czysty tekst bez nagłówków/stopek.
3. Zwróć TYLKO JSON.

DOKUMENT:
${documentText}`;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('❌ Brak ANTHROPIC_API_KEY');
      return NextResponse.json({ error: 'Brak klucza API' }, { status: 500 });
    }

    // Wywołanie AI
    console.log('🧠 Wysyłanie do API Anthropic...');
    const apiResponse = await callAnthropicAPI(anthropicApiKey, prompt, AI_MODEL);
    console.log('✅ Otrzymano odpowiedź z API');

    let decisionData: DecisionData;
    if (apiResponse.content && apiResponse.content.length > 0) {
      decisionData = parseJSONFromResponse(apiResponse.content[0].text);
      console.log('✅ JSON sparsowany pomyślnie');
    } else {
      throw new Error('Pusta odpowiedź z API');
    }

    // 🔍 DEBUG - Budowanie URL
    console.log('───────────────────────────────────────────────');
    console.log('🔗 BUDOWANIE URL DO PLIKU:');

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');
    const appUrl = `${protocol}://${host}`;
    console.log('  1. APP_URL:', appUrl);

    let finalFileName = fileName || decisionData.filePath || 'unknown.pdf';
    console.log('  2. fileName (przed normalize):', finalFileName);

    finalFileName = normalizeFilename(finalFileName);
    console.log('  3. fileName (po normalize):', finalFileName);

    const publicUrl = `${appUrl}/api/assets/${finalFileName}`;
    console.log('  4. 🎯 FINAL URL:', publicUrl);

    // Sprawdzenie czy plik istnieje na dysku
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    const diskPath = path.join(uploadDir, finalFileName);
    console.log('  5. Ścieżka na dysku:', diskPath);

    const { existsSync } = await import('fs');
    const fileExists = existsSync(diskPath);
    console.log('  6. Czy plik istnieje:', fileExists ? '✅ TAK' : '❌ NIE');

    if (!fileExists) {
      console.warn('⚠️  UWAGA: Plik nie istnieje na dysku! URL będzie prowadzić do 404');
    }

    console.log('───────────────────────────────────────────────');

    // Zapis do bazy
    console.log('💾 Zapisywanie do bazy danych...');
    const decision = await prisma.decision.create({
      data: {
        documentDate: decisionData.documentDate,
        decisionNumber: decisionData.decisionNumber,
        banYears: decisionData.banYears,
        legalBasisKpa: decisionData.legalBasisKpa,
        legalBasisUitput: decisionData.legalBasisUitput,
        appealDays: decisionData.appealDays,
        appealCourt: decisionData.appealCourt,
        signedBy: decisionData.signedBy,
        filePath: finalFileName,
        url: publicUrl,
        status: decisionData.status,
        decisionText: decisionData.decisionText,
        organizator: decisionData.organizator,
      }
    });

    console.log('✅ Zapisano do bazy z ID:', decision.id);
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 PROCES ZAKOŃCZONY SUKCESEM');
    console.log('═══════════════════════════════════════════════');

    return NextResponse.json({
      success: true,
      decisionId: decision.id,
      fileUrl: publicUrl,
      data: decisionData
    }, { status: 201 });

  } catch (error) {
    console.error('═══════════════════════════════════════════════');
    console.error('❌ BŁĄD PODCZAS PRZETWARZANIA');
    console.error('═══════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════');

    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active' });
}