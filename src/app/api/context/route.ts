// PLIK: src/app/api/context/route.ts
// WERSJA 2.1 - Dodano fallback dla art_no (nawiasy)
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { act, article, paragraph, point } = await req.json();

    console.log('\n==================== [API CONTEXT START] ====================');
    console.log('📍 Żądanie kontekstu dla:');
    console.log(`   Act: ${act || 'NULL'}`);
    console.log(`   Art (input): ${article || 'NULL'}`);
    console.log(`   Par: ${paragraph || 'NULL'}`);
    console.log(`   Pkt: ${point || 'NULL'}`);

    if (!act || !article) {
      return NextResponse.json(
        { error: "Brak wymaganych parametrów: act i article" },
        { status: 400 }
      );
    }

    // =========================================================================
    // KROK 1: Znajdź dokładny rekord (current) z obsługą FALLBACK dla art_no
    // =========================================================================

    let currentResult: any = { rows: [] };
    let foundArticleVariant = null;

    // Próbujemy 4 podejścia:
    // i=0: Oryginał (np. "115320")
    // i=1: Ostatni znak w nawias (np. "11532(0)")
    // i=2: Ostatnie 2 znaki w nawias (np. "1153(20)")
    // i=3: Ostatnie 3 znaki w nawias (np. "115(320)")

    for (let i = 0; i <= 3; i++) {
      let candidateArticle = article;

      if (i > 0) {
        // Zabezpieczenie: jeśli artykuł jest krótszy niż liczba znaków do przeniesienia, przerywamy
        if (article.length <= i) break;

        const mainPart = article.slice(0, article.length - i);
        const parenPart = article.slice(article.length - i);
        candidateArticle = `${mainPart}(${parenPart})`;
      }

      console.log(`\n🔍 Próba ${i + 1}/4: Szukam Art. "${candidateArticle}"...`);

      let currentSql = '';
      let currentParams: any[] = [];

      if (point) {
        currentSql = `
          SELECT id, act, art_no, par_no, pkt_no, text, text_clean
          FROM context
          WHERE act = $1 AND art_no = $2 AND par_no = $3 AND pkt_no = $4
          LIMIT 1;
        `;
        currentParams = [act, candidateArticle, paragraph, point];
      } else if (paragraph) {
        currentSql = `
          SELECT id, act, art_no, par_no, pkt_no, text, text_clean
          FROM context
          WHERE act = $1 AND art_no = $2 AND par_no = $3 AND pkt_no IS NULL
          LIMIT 1;
        `;
        currentParams = [act, candidateArticle, paragraph];
      } else {
        currentSql = `
          SELECT id, act, art_no, par_no, pkt_no, text, text_clean
          FROM context
          WHERE act = $1 AND art_no = $2 AND par_no IS NULL AND pkt_no IS NULL
          LIMIT 1;
        `;
        currentParams = [act, candidateArticle];
      }

      const result = await pool.query(currentSql, currentParams);

      if (result.rows.length > 0) {
        currentResult = result;
        foundArticleVariant = candidateArticle;
        console.log(`✅ SUKCES! Znaleziono przy wariancie: "${candidateArticle}"`);
        break; // Przerywamy pętlę, bo znaleźliśmy
      } else {
        console.log(`   Nie znaleziono.`);
      }
    }

    if (currentResult.rows.length === 0) {
      console.log('❌ Ostatecznie nie znaleziono fragmentu po wszystkich próbach.');
      console.log('==================== [API CONTEXT END] ====================\n');
      return NextResponse.json({
        before: [],
        current: null,
        after: []
      });
    }

    const current = currentResult.rows[0];
    const currentId = current.id;

    console.log(`✅ ID rekordu: ${currentId}`);

    // =========================================================================
    // KROK 2: Pobierz fragmenty PRZED (previous)
    // =========================================================================

    const beforeSql = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean
      FROM context
      WHERE act = $1 AND id < $2
      ORDER BY id DESC
      LIMIT 3;
    `;

    console.log('\n⬅️  Pobieram 3 fragmenty przed...');
    const beforeResult = await pool.query(beforeSql, [act, currentId]);
    const before = beforeResult.rows.reverse();

    console.log(`   Znaleziono: ${before.length} fragmentów`);
    before.forEach(row => {
      const label = formatLabel(row);
      console.log(`   • ${label}`);
    });

    // =========================================================================
    // KROK 3: Pobierz fragmenty PO (next)
    // =========================================================================

    const afterSql = `
      SELECT id, act, art_no, par_no, pkt_no, text, text_clean
      FROM context
      WHERE act = $1 AND id > $2
      ORDER BY id ASC
      LIMIT 3;
    `;

    console.log('\n➡️  Pobieram 3 fragmenty po...');
    const afterResult = await pool.query(afterSql, [act, currentId]);
    const after = afterResult.rows;

    console.log(`   Znaleziono: ${after.length} fragmentów`);
    after.forEach(row => {
      const label = formatLabel(row);
      console.log(`   • ${label}`);
    });

    // =========================================================================
    // KROK 4: Formatowanie wyników
    // =========================================================================

    const formatRow = (row: any) => ({
      id: row.id.toString(),
      act: row.act,
      art_no: row.art_no,
      par_no: row.par_no,
      pkt_no: row.pkt_no,
      text: row.text,
      text_clean: row.text_clean
    });

    const response = {
      before: before.map(formatRow),
      current: formatRow(current),
      after: after.map(formatRow)
    };

    console.log('\n📦 WYNIK:');
    console.log(`   Przed: ${response.before.length}`);
    console.log(`   Bieżący: ✓ (Art. ${foundArticleVariant})`);
    console.log(`   Po: ${response.after.length}`);
    console.log('==================== [API CONTEXT END] ====================\n');

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Context API Error:", error);
    return NextResponse.json(
      { error: "Błąd serwera bazy danych" },
      { status: 500 }
    );
  }
}

// Funkcja pomocnicza do formatowania etykiet w logach
function formatLabel(row: any): string {
  const parts = [];
  if (row.act) parts.push(row.act);
  if (row.art_no) parts.push(`Art. ${row.art_no}`);
  if (row.par_no && row.par_no !== 'cumulated' && row.par_no !== 'moved') {
    parts.push(`§ ${row.par_no}`);
  }
  if (row.pkt_no && row.pkt_no !== 'cumulated' && row.pkt_no !== 'moved') {
    parts.push(`pkt ${row.pkt_no}`);
  }
  return parts.join(' ') || `ID: ${row.id}`;
}