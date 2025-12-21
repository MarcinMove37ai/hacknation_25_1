// PLIK: src/app/api/acts-search/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getVoyageEmbedding(text: string): Promise<number[]> {
  const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || process.env.NEXT_PUBLIC_VOYAGE_API_KEY;
  if (!VOYAGE_API_KEY) throw new Error('Brak klucza API Voyage');

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-law-2'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voyage API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Helper do mapowania wyników
const mapRow = (row: any, type: string) => {
  const titleParts = [];
  if (row.act) titleParts.push(row.act);
  if (row.art_no) titleParts.push(`Art. ${row.art_no}`);
  // Ukrywamy par/pkt jeśli są oznaczone jako 'cumulated', żeby nie wyświetlać "§ cumulated"
  if (row.par_no && row.par_no !== 'cumulated' && row.par_no !== 'moved') titleParts.push(`§ ${row.par_no}`);
  if (row.pkt_no && row.pkt_no !== 'cumulated' && row.pkt_no !== 'moved') titleParts.push(`pkt ${row.pkt_no}`);

  return {
    id: row.id.toString(),
    type: type,
    act: row.act,
    article: row.art_no,
    paragraph: (row.par_no === 'cumulated' || row.par_no === 'moved') ? null : row.par_no,
    point: (row.pkt_no === 'cumulated' || row.pkt_no === 'moved') ? null : row.pkt_no,
    title: titleParts.join(' ') || 'Fragment aktu prawnego',
    content: row.text,
    text_clean: row.text_clean,
    relevance_score: row.similarity // Przekazujemy score (dla dzieci będzie to score rodzica)
  };
};

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Brak zapytania" }, { status: 400 });
    }

    console.log('\n==================== [API SEARCH START] ====================');
    console.log('🔍 Pytanie:', query);

    // 1. Generowanie embeddingu
    const queryEmbedding = await getVoyageEmbedding(query);
    const vectorString = JSON.stringify(queryEmbedding);

    // 2. Przygotowanie zapytań wektorowych (RÓWNOLEGLE)

    // A. Szukamy ogółów w acts_cumulated
    const sqlCumulatedSearch = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean,
             1 - (embedding <=> $1::vector) as similarity
      FROM acts_cumulated
      ORDER BY embedding <=> $1::vector
      LIMIT 5;
    `;

    // B. Szukamy szczegółów w acts
    const sqlActsSearch = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean,
             1 - (embedding <=> $1::vector) as similarity
      FROM acts
      ORDER BY embedding <=> $1::vector
      LIMIT 10;
    `;

    // 3. Wykonanie obu wyszukiwań na raz
    const [resCumulatedVector, resActsVector] = await Promise.all([
      pool.query(sqlCumulatedSearch, [vectorString]),
      pool.query(sqlActsSearch, [vectorString])
    ]);

    console.log(`\n📊 WYNIKI WEKTOROWE:`);
    console.log(`   • acts_cumulated: ${resCumulatedVector.rows.length}`);
    console.log(`   • acts: ${resActsVector.rows.length}`);

    // 4. Przetwarzanie wyników z acts_cumulated -> DEKOMPOZYCJA przez tabelę CONTEXT
    const processedCumulated = [];
    console.log(`\n🔄 DEKOMPOZYCJA (z tabeli context):`);

    for (const row of resCumulatedVector.rows) {
      const isArticleLevel = row.par_no === 'cumulated' && row.pkt_no === 'cumulated';
      const isParagraphLevel = row.par_no !== 'cumulated' && row.pkt_no === 'cumulated';
      // Uwaga: Może być też wariant, że par_no = 'cumulated', a pkt_no jest NULL (zależy jak masz w bazie)

      let decompositionSql = '';
      let queryParams: any[] = [];
      let logMsg = '';

      // Budujemy zapytanie do tabeli CONTEXT (zwykły SQL, nie wektorowy)
      if (row.par_no === 'cumulated') {
        // -- Poziom Artykułu: Pobierz wszystkie paragrafy z context --
        decompositionSql = `
          SELECT id, act, art_no, par_no, pkt_no, text, text_clean
          FROM context
          WHERE act = $1 AND art_no = $2
          AND (par_no != 'cumulated' OR par_no IS NULL) -- pomijamy nagłówki
          ORDER BY id ASC;
        `;
        queryParams = [row.act, row.art_no];
        logMsg = `[${row.act} Art. ${row.art_no}] (cumulated) → Pobieram dzieci z context`;

      } else if (row.pkt_no === 'cumulated') {
        // -- Poziom Paragrafu: Pobierz wszystkie punkty z context --
        decompositionSql = `
          SELECT id, act, art_no, par_no, pkt_no, text, text_clean
          FROM context
          WHERE act = $1 AND art_no = $2 AND par_no = $3
          AND (pkt_no != 'cumulated' OR pkt_no IS NULL)
          ORDER BY id ASC;
        `;
        queryParams = [row.act, row.art_no, row.par_no];
        logMsg = `[${row.act} Art. ${row.art_no} §${row.par_no}] (cumulated) → Pobieram dzieci z context`;
      } else {
        // Przypadek brzegowy: rekord w acts_cumulated nie ma flagi 'cumulated'?
        // Traktujemy jak zwykły rekord, ale to nie powinno się zdarzyć w tej tabeli.
        decompositionSql = '';
      }

      if (decompositionSql) {
        console.log(`   🔸 ${logMsg}`);
        const contextRes = await pool.query(decompositionSql, queryParams);

        if (contextRes.rows.length > 0) {
          console.log(`      ↳ Znaleziono ${contextRes.rows.length} elementów w context.`);
          for (const childRow of contextRes.rows) {
            // Dziecko dziedziczy similarity rodzica (żeby frontend wiedział jak sortować grupę)
            childRow.similarity = row.similarity;
            processedCumulated.push(mapRow(childRow, 'expanded'));
          }
        } else {
          // Fallback: jeśli context jest pusty, zwracamy sam nagłówek
          console.log(`      ⚠️  Brak danych w context. Zwracam nagłówek.`);
          processedCumulated.push(mapRow(row, 'cumulated'));
        }
      } else {
         // Rekord z acts_cumulated bez flag cumulated? Zwracamy jak jest.
         processedCumulated.push(mapRow(row, 'cumulated'));
      }
    }

    // 5. Przetwarzanie wyników z acts (zwykłe)
    // Tu po prostu mapujemy to, co przyszło z bazy
    const detailedResults = resActsVector.rows.map(row => mapRow(row, 'ori'));
    console.log(`   ✓ Przetworzono ${detailedResults.length} wyników bezpośrednich z acts.`);

    console.log('==================== [API SEARCH END] ====================\n');

    return NextResponse.json({
      cumulated: processedCumulated,
      detailed: detailedResults
    });

  } catch (error) {
    console.error("❌ Database Search API Error:", error);
    return NextResponse.json({
        error: "Błąd serwera bazy danych",
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}