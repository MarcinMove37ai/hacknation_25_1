// PLIK: src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Odbieramy messages, context ORAZ knowledgeSummary (nowość)
    const { messages, context, knowledgeSummary } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Brak historii wiadomości" }, { status: 400 });
    }

    // 1. Wyciągamy ostatnie pytanie
    const lastUserMessage = messages[messages.length - 1];
    const lastQuestion = lastUserMessage.content || "Brak pytania";

    // 2. Konstrukcja Promptu Systemowego
    // Wersja "Strict Legal" + "Comfort Summary" + "Rolling Knowledge"
    const systemPrompt = `Jesteś eksperckim Asystentem Prawnym.

TWOJE ZADANIE:
Udziel porady prawnej na temat: "${lastQuestion}"

STATUS WIEDZY UŻYTKOWNIKA (Co już ustalono w rozmowie):
${knowledgeSummary ? knowledgeSummary : 'To jest początek rozmowy. Brak ustalonych faktów.'}

MATERIAŁY ŹRÓDŁOWE:
<źródła>
${context ? context : 'BRAK DOSTĘPNYCH ŹRÓDEŁ - poinformuj o tym użytkownika.'}
</źródła>

Rygorystyczne zasady udzielania odpowiedzi:

1. **ZASADA BEZPOŚREDNIOŚCI:**
   - NIE powtarzaj pytania użytkownika.
   - NIE pisz wstępów. Zacznij od razu od pierwszego konkretu/przepisu.

2. **ZASADA CIĄGŁEGO PRZYWOŁYWANIA PRAWA:**
   - Każdy akapit lub nowy wątek MUSI zaczynać się od konstrukcji typu: "Zgodnie z [oznaczenie] [akt]..." lub "Na podstawie [oznaczenie] [akt]...".
   - Wartości [oznaczenie] i [akt] pobieraj WYŁĄCZNIE z atrybutów dostarczonych w tagach XML.

3. **ZASADA CYTOWANIA (DLA CZYTELNIKA):**
   - Na końcu zdań wstawiaj indeksy: [1], [2].
   - Używaj numeracji sekwencyjnej.

4. **FORMATOWANIE:**
   - Używaj nagłówków (##) dla czytelności.
   - **Pogrubiaj** nazwy aktów i numery artykułów.

5. **PODSUMOWANIE (DLA KOMFORTU UŻYTKOWNIKA):**
   - Na samym końcu części tekstowej (przed JSONem) dodaj sekcję nagłówkową "## Wnioski".
   - Napisz tam 2-3 zdania prostym, zrozumiałym językiem (bez prawniczego żargonu).
   - Celem tej sekcji jest synteza odpowiedzi i uspokojenie użytkownika poprzez jasne wskazanie, co z powyższych przepisów dla niego wynika w praktyce.

FORMAT KOŃCOWY (JSON):
Każdą odpowiedź ZAKOŃCZ strukturą JSON. Musi ona zawierać źródła ORAZ skondensowane podsumowanie merytoryczne tej odpowiedzi dla potrzeb kontekstu w kolejnym pytaniu.

Format bloku JSON:
\`\`\`json
{
  "summary_for_next_turn": "Jedno zdanie podsumowujące co ustalono, np: Użytkownik wie, że odwołanie wnosi się w terminie 14 dni do organu wyższego stopnia.",
  "sources": [
    { "index": 1, "id": "ID_Z_ATRYBUTU_XML", "description": "Art. X KPA" }
  ]
}
\`\`\`
Ten JSON musi być absolutnie ostatnim elementem odpowiedzi.

KONTEKST ROZMOWY:
Poniżej historia konwersacji:
`;

    // --- PEŁNE LOGOWANIE DLA DEBUGOWANIA ---
    console.log('\n================ [CHAT API REQUEST START] ================');
    console.log('🤖 Model: claude-haiku-4-5');

    console.log('\n📜 --- SYSTEM PROMPT ---');
    console.log(systemPrompt);

    // Wywołanie Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5', // lub claude-3-5-sonnet-20241022
      max_tokens: 2048,
      messages: messages,
      system: systemPrompt
    });

    // --- LOGOWANIE OUTPUTU ---
    console.log('\n✅ --- ODPOWIEDŹ AI (STATS) ---');
    console.log(`Input tokens: ${response.usage.input_tokens}`);
    console.log(`Output tokens: ${response.usage.output_tokens}`);
    console.log('================ [CHAT API REQUEST END] ================\n');

    let assistantContent = '';
    if (response.content && response.content.length > 0) {
      const contentBlock = response.content[0];
      if ('text' in contentBlock) {
        assistantContent = contentBlock.text;
      }
    }

    return NextResponse.json({ content: assistantContent });

  } catch (error) {
    console.error("❌ Chat API Error:", error);
    return NextResponse.json({ error: "Błąd serwera AI" }, { status: 500 });
  }
}