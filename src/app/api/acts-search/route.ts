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

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Brak zapytania" }, { status: 400 });
    }

    console.log('\n--- [API SEARCH START] ---');
    console.log('📝 Pytanie:', query);

    // 1. Generowanie embeddingu
    const queryEmbedding = await getVoyageEmbedding(query);
    const vectorString = JSON.stringify(queryEmbedding);

    // 2. Definicja zapytań SQL
    // Zapytanie A: acts_cumulated (Limit 5)
    const sqlCumulated = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean,
             1 - (embedding <=> $1::vector) as similarity
      FROM acts_cumulated
      ORDER BY embedding <=> $1::vector
      LIMIT 5;
    `;

    // Zapytanie B: acts (Limit 10)
    const sqlActs = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean,
             1 - (embedding <=> $1::vector) as similarity
      FROM acts
      ORDER BY embedding <=> $1::vector
      LIMIT 10;
    `;

    // 3. Wykonanie zapytań równolegle (Promise.all dla szybkości)
    const [resCumulated, resActs] = await Promise.all([
      pool.query(sqlCumulated, [vectorString]),
      pool.query(sqlActs, [vectorString])
    ]);

    // 4. Funkcja pomocnicza do mapowania wyników
    const mapRow = (row: any, type: 'cumulated' | 'detailed') => {
      const titleParts = [];
      if (row.act) titleParts.push(row.act);
      if (row.art_no) titleParts.push(`Art. ${row.art_no}`);
      if (row.par_no && row.par_no !== 'cumulated') titleParts.push(`§ ${row.par_no}`);
      if (row.pkt_no && row.pkt_no !== 'cumulated' && row.pkt_no !== 'moved') titleParts.push(`pkt ${row.pkt_no}`);

      return {
        id: row.id.toString(),
        type: type, // Ważne: oznaczamy skąd pochodzi rekord
        act: row.act,
        article: row.art_no,
        paragraph: row.par_no === 'cumulated' ? null : row.par_no,
        title: titleParts.join(' ') || 'Fragment aktu prawnego',
        content: row.text,
        text_clean: row.text_clean,
        relevance_score: row.similarity
      };
    };

    const cumulatedResults = resCumulated.rows.map(row => mapRow(row, 'cumulated'));
    const detailedResults = resActs.rows.map(row => mapRow(row, 'detailed'));

    console.log(`🔍 Znaleziono: ${cumulatedResults.length} (cumulated) + ${detailedResults.length} (detailed)`);
    console.log('--- [API SEARCH END] ---\n');

    // 5. Zwracamy obiekt z podziałem na dwie listy
    return NextResponse.json({
      cumulated: cumulatedResults,
      detailed: detailedResults
    });

  } catch (error) {
    console.error("❌ Database Search API Error:", error);
    return NextResponse.json({ error: "Błąd serwera bazy danych" }, { status: 500 });
  }
}