// src/app/api/decisions/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Interfejs dla odpowiedzi z API Anthropic
interface AnthropicResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  type: string;
}

// Interfejs dla danych decyzji
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
}

// Funkcja do wywołania API Anthropic
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
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Błąd API Anthropic:', errorData);
    throw new Error(`API Anthropic zwróciło błąd: ${response.status}`);
  }

  return response.json();
}

// Funkcja do parsowania odpowiedzi JSON
function parseJSONFromResponse(responseText: string): DecisionData {
  // Próba bezpośredniego parsowania
  try {
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.log('Bezpośrednie parsowanie JSON nie powiodło się, szukam w bloku markdown');

    // Szukanie JSON w bloku markdown
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (jsonError) {
        console.error('Nie udało się sparsować JSON z bloku kodu:', jsonError);
        throw new Error('Nie udało się sparsować JSON z bloku kodu');
      }
    } else {
      console.error('Nie znaleziono bloku kodu JSON w odpowiedzi');
      throw new Error('Nie udało się wyodrębnić poprawnego JSON z odpowiedzi');
    }
  }
}

// GŁÓWNY HANDLER POST
export async function POST(request: NextRequest) {
  try {
    // 1. Pobranie danych z requestu
    const body = await request.json();
    const { documentText, fileName } = body;

    if (!documentText) {
      return NextResponse.json({
        error: 'Nie podano tekstu dokumentu do przetworzenia.'
      }, { status: 400 });
    }

    console.log('📄 Rozpoczynam przetwarzanie dokumentu odwołania...');
    console.log('📝 Długość tekstu:', documentText.length, 'znaków');
    if (fileName) {
      console.log('📁 Nazwa pliku:', fileName);
    }

    // 2. Definicja modelu AI
    const AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';

    // 3. Utworzenie prompta dla Claude
    const prompt = `Jesteś ekspertem od analizy dokumentów prawnych. Przeanalizuj poniższy dokument odwołania od decyzji Marszałka Województwa dotyczący naruszenia przepisów o organizatorach turystyki.

Wyciągnij następujące informacje i zwróć je w formacie JSON (tylko czysty JSON, bez żadnego dodatkowego tekstu):

{
  "documentDate": "Data dokumentu w formacie YYYY-MM-DD",
  "decisionNumber": "Numer sprawy/decyzji (np. KP-TP-III.5222.7.16.2022.EL)",
  "banYears": 3,
  "legalBasisKpa": "Pełna podstawa prawna z Kodeksu postępowania administracyjnego",
  "legalBasisUitput": "Pełna podstawa prawna z ustawy o imprezach turystycznych",
  "appealDays": 30,
  "appealCourt": "Pełna nazwa i adres organu odwoławczego (MINISTERSTWO SPORTU I TURYSTYKI + adres)",
  "signedBy": "Osoba podpisująca dokument z pełnym stanowiskiem",
  "filePath": "${fileName || 'dokument.pdf'}",
  "status": "nowy"
}

INSTRUKCJE:
- Zawsze ustawiaj "appealDays" na 30
- Zawsze ustawiaj "status" na "nowy"
- "banYears" to liczba lat zakazu (zazwyczaj 3)
- Dokładnie przepisz numery decyzji i podstawy prawne
- Data powinna być w formacie YYYY-MM-DD
- Zwróć TYLKO JSON, bez żadnego dodatkowego tekstu przed ani po

DOKUMENT DO ANALIZY:

${documentText}`;

    // 4. Pobranie klucza API Anthropic
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('Brak klucza API Anthropic w zmiennych środowiskowych');
      return NextResponse.json({
        error: 'Konfiguracja serwera nieprawidłowa. Skontaktuj się z administratorem.'
      }, { status: 500 });
    }

    // 5. Wywołanie API Anthropic
    console.log('🤖 Wysyłanie żądania do API Anthropic...');
    console.log(`🤖 Używam modelu: ${AI_MODEL}`);
    const apiResponse = await callAnthropicAPI(anthropicApiKey, prompt, AI_MODEL);
    console.log('✅ Otrzymano odpowiedź z API Anthropic');

    // 6. Parsowanie odpowiedzi JSON
    let decisionData: DecisionData;

    if (apiResponse.content && apiResponse.content.length > 0) {
      const responseText = apiResponse.content[0].text;
      console.log('📋 Surowa odpowiedź AI:', responseText.substring(0, 200) + '...');
      decisionData = parseJSONFromResponse(responseText);
      console.log('✅ Pomyślnie sparsowano odpowiedź JSON');
    } else {
      console.error('❌ Nieprawidłowy format odpowiedzi z API Anthropic');
      throw new Error('Nieprawidłowy format odpowiedzi z API Anthropic');
    }

    // 7. Zapisanie do bazy danych
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
        filePath: decisionData.filePath,
        status: decisionData.status
      }
    });

    console.log(`✅ Pomyślnie utworzono rekord decyzji z ID: ${decision.id}`);

    // 8. Zwrócenie sukcesu
    return NextResponse.json({
      success: true,
      message: 'Dokument został pomyślnie przetworzony i zapisany',
      decisionId: decision.id,
      decisionNumber: decision.decisionNumber,
      data: decisionData
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Błąd podczas przetwarzania dokumentu:', error);

    // Rozróżnienie typów błędów
    if (error instanceof Error) {
      if (error.message.includes('API Anthropic')) {
        return NextResponse.json({
          error: 'Błąd komunikacji z usługą AI. Spróbuj ponownie za chwilę.'
        }, { status: 503 });
      }

      if (error.message.includes('JSON')) {
        return NextResponse.json({
          error: 'Błąd przetwarzania odpowiedzi AI. Skontaktuj się z administratorem.'
        }, { status: 500 });
      }

      return NextResponse.json({
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Wystąpił nieoczekiwany błąd podczas przetwarzania dokumentu.'
    }, { status: 500 });
  }
}

// Opcjonalnie: GET endpoint do testowania
export async function GET() {
  return NextResponse.json({
    message: 'Endpoint do przetwarzania dokumentów odwołań',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        documentText: 'string (wymagane) - Pełny tekst dokumentu',
        fileName: 'string (opcjonalne) - Nazwa pliku źródłowego'
      },
      example: {
        documentText: 'Warszawa, 14 sierpnia 2023 r. ...',
        fileName: 'odwolanie.pdf'
      }
    }
  });
}