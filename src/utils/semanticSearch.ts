// utils/semanticSearch.ts
// Semantic search z Voyage AI (voyage-3.5-lite, 512 dimensions)

export interface KPAChunk {
  art_no: string | null;
  art_index: string | null;
  par_no: string | null;
  par_index: string | null;
  pkt_no: string | null;
  text: string;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  article?: string;
  paragraph?: string;
  title: string;
  content: string;
  relevance_score: number;
}

// Cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Voyage AI API call
async function getVoyageEmbedding(text: string): Promise<number[]> {
  const VOYAGE_API_KEY = process.env.NEXT_PUBLIC_VOYAGE_API_KEY;
  const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

  if (!VOYAGE_API_KEY) {
    throw new Error('NEXT_PUBLIC_VOYAGE_API_KEY not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-3.5-lite'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Główna funkcja semantic search
export async function semanticSearch(
  query: string,
  kpaData: KPAChunk[],
  topK: number = 5
): Promise<SearchResult[]> {

  // 1. Wygeneruj embedding dla query
  let queryEmbedding: number[];

  try {
    console.log('🔍 Generating query embedding...');
    queryEmbedding = await getVoyageEmbedding(query);
    console.log(`✅ Query embedding generated (${queryEmbedding.length} dims)`);
  } catch (error) {
    console.error('❌ Błąd generowania embeddings:', error);
    return [];
  }

  // 2. Oblicz similarity dla wszystkich chunks
  const scored = kpaData
    .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
    .map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!)
    }));

  console.log(`📊 Scored ${scored.length} chunks`);

  // 3. Sortuj i weź top K
  const topResults = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(`🎯 Top ${topK} results:`, topResults.map(r => ({
    score: r.score.toFixed(3),
    art: r.chunk.art_no
  })));

  // 4. Formatuj wyniki
  return topResults.map((item, idx) => {
    const chunk = item.chunk;

    // Stwórz tytuł
    const titleParts = [];
    if (chunk.art_no) titleParts.push(`Art. ${chunk.art_no}`);
    if (chunk.par_no) titleParts.push(`§ ${chunk.par_no}`);
    if (chunk.pkt_no) titleParts.push(`pkt ${chunk.pkt_no}`);

    const title = titleParts.length > 0
      ? titleParts.join(' ')
      : 'Kodeks postępowania administracyjnego';

    return {
      id: `${idx}`,
      article: chunk.art_no || undefined,
      paragraph: chunk.par_no || undefined,
      title,
      content: chunk.text,
      relevance_score: item.score
    };
  });
}

// Funkcja pomocnicza - ładowanie KPA data
export async function loadKPAData(): Promise<KPAChunk[]> {
  try {
    console.log('📚 Loading KPA data...');
    // Załaduj z public/kpa-embeddings.json
    const response = await fetch('/kpa-embeddings.json');
    if (!response.ok) throw new Error('Failed to load KPA data');

    const data: KPAChunk[] = await response.json();

    const withEmbeddings = data.filter(d => d.embedding && d.embedding.length > 0).length;
    console.log(`✅ Załadowano ${data.length} chunks z KPA (${withEmbeddings} z embeddingami)`);

    return data;
  } catch (error) {
    console.error('❌ Błąd ładowania KPA data:', error);
    return [];
  }
}