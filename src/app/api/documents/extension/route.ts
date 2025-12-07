// app/api/documents/extension/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { prisma } from '@/lib/prisma';

// miesiące w dopełniaczu
const POLISH_MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

// liczba dni przedłużenia (możesz ustawić w .env: EXTENSION_DAYS=30)
const EXTENSION_DAYS = Number(process.env.EXTENSION_DAYS ?? '30') || 30;

function formatPolishDate(date: Date): string {
  const day = date.getDate();
  const month = POLISH_MONTHS_GENITIVE[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year} r.`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Helper: zamienia blok tekstu z \n na Paragraph z TextRunami i złamaniami linii.
 */
function paragraphFromMultiline(text: string): Paragraph {
  const lines = text.split('\n');

  return new Paragraph({
    children: lines.map((line, index) =>
      new TextRun({
        text: line,
        break: index === 0 ? 0 : 1,
      })
    ),
  });
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const decisionId = body.decisionId as string | undefined;

    if (!decisionId) {
      return NextResponse.json(
        { error: 'decisionId jest wymagane' },
        { status: 400 }
      );
    }

    // 1. Pobieramy decyzję wraz z draftem przedłużenia
    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { extensionDraft: true },
    });

    if (!decision) {
      return NextResponse.json(
        { error: 'Nie znaleziono decyzji.' },
        { status: 404 }
      );
    }

    const draft = decision.extensionDraft;

    if (!draft) {
      return NextResponse.json(
        {
          error:
            'Brak projektu przedłużenia dla tej decyzji. Użyj "Przetwarzaj" i/lub zapisz zmiany w edycji.',
        },
        { status: 400 }
      );
    }

    // 2. Dane do dokumentu – WYŁĄCZNIE z bazy
    const decisionNumber = draft.decisionNumber;
    const organizer = draft.organizer;
    const legalForm = draft.legalForm || 'Stowarzyszenie';
    const organizerAddress =
      draft.organizerAddress || 'brak adresu (uzupełnij w systemie)';
    const documentDateStr = draft.documentDate; // 'YYYY-MM-DD'
    const decisionText =
      draft.decisionText || decision.decisionText || '(brak uzasadnienia)';

    // 3. Daty
    const today = new Date();
    const marszalekDate = new Date(documentDateStr);
    const newDeadline = addDays(today, EXTENSION_DAYS);

    const todayStr = formatPolishDate(today);
    const marszalekDateStr = formatPolishDate(marszalekDate);
    const newDeadlineStr = formatPolishDate(newDeadline);

    // 4. Składamy treść dokumentu (to jest Twoja logika z poprzedniej wersji)
    const headerText = `(22) ul. Senatorska 14
kontakt@msit.gov.pl 00-082 Warszawa
www.gov.pl/sport

Warszawa, dnia ${todayStr}`;

    const point1Text = `1. Na podstawie art. 36 § 1 ustawy z dnia 14 czerwca 1960 r. – Kodeks postępowania administracyjnego (Dz.U. z 2023 r. poz. 775 z późn. zm.), w związku z odwołaniem ${legalForm} ${organizer}, z siedzibą w ${organizerAddress}, od decyzji Marszałka Województwa Mazowieckiego z dnia ${marszalekDateStr}, nr ${decisionNumber}, w sprawie stwierdzenia wykonywania działalności organizatora turystyki bez wymaganego wpisu do Rejestru Organizatorów Turystyki i Przedsiębiorców Ułatwiających Nabywanie Powiązanych Usług Turystycznych Województwa Mazowieckiego oraz zakazu wykonywania działalności organizatora turystyki przez okres 3 lat – przedłużam termin załatwienia sprawy.`;

    const point2Text = `2. Nowy termin załatwienia sprawy wyznacza się do dnia ${newDeadlineStr}.`;

    const uzasadnienieIntro = 'Uzasadnienie';

    const uzasadnienieBody = decisionText;

    const uzasadnienieEnd = `Mając na uwadze konieczność dokładnego wyjaśnienia sprawy, w szczególności analizę zgromadzonego materiału dowodowego oraz zapewnienie stronie czynnego udziału w postępowaniu, zaistniała potrzeba przedłużenia terminu załatwienia sprawy, o czym należało postanowić jak w sentencji.`;

    const pouczenieTitle = 'Pouczenie';

    const pouczenieText = `Na niniejsze postanowienie służy zażalenie do Samorządowego Kolegium Odwoławczego w Warszawie za pośrednictwem Marszałka Województwa Mazowieckiego w terminie 7 dni od dnia doręczenia postanowienia.`;

    const podstawaPrawna = `Podstawa prawna:
- art. 36 § 1 ustawy z dnia 14 czerwca 1960 r. – Kodeks postępowania administracyjnego (Dz.U. z 2023 r. poz. 775 z późn. zm.),
- art. 10 § 1 K.p.a.`;

    const podpisBlock = `Z upoważnienia Ministra Sportu i Turystyki
Marcin Lisiak
Zastępca Dyrektora Departamentu Kultury, Promocji i Turystyki 😊`;

    const otrzymujaBlock = `Otrzymują:
1. Adresat
2. a/a

Do wiadomości:`;

    // 5. Budujemy strukturę DOCX
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            paragraphFromMultiline(headerText),
            new Paragraph({ text: '' }), // pusty odstęp

            new Paragraph({
              children: [
                new TextRun({
                  text: 'POSTANOWIENIE',
                  bold: true,
                }),
              ],
              spacing: { after: 200 },
            }),

            paragraphFromMultiline(point1Text),
            new Paragraph({ text: '' }),
            paragraphFromMultiline(point2Text),
            new Paragraph({ text: '' }),

            new Paragraph({
              children: [new TextRun({ text: uzasadnienieIntro, bold: true })],
            }),
            new Paragraph({ text: '' }),

            paragraphFromMultiline(uzasadnienieBody),
            new Paragraph({ text: '' }),
            paragraphFromMultiline(uzasadnienieEnd),
            new Paragraph({ text: '' }),

            new Paragraph({
              children: [new TextRun({ text: pouczenieTitle, bold: true })],
            }),
            new Paragraph({ text: '' }),

            paragraphFromMultiline(pouczenieText),
            new Paragraph({ text: '' }),

            paragraphFromMultiline(podstawaPrawna),
            new Paragraph({ text: '' }),

            paragraphFromMultiline(podpisBlock),
            new Paragraph({ text: '' }),

            paragraphFromMultiline(otrzymujaBlock),
          ],
        },
      ],
    });

    // 6. Generujemy DOCX w pamięci
    const buffer = await Packer.toBuffer(doc);

    // 7. Zwracamy jako plik do pobrania
    const fileName = `postanowienie_przedluzenie_${decisionId}.docx`;

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { error: 'Failed to generate document.' },
      { status: 500 }
    );
  }
}
