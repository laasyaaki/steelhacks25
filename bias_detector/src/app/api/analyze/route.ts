import { NextResponse } from 'next/server';


export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const BIASED_WORDS = [
      "obviously", "clearly", "undoubtedly", "surely", "certainly",
      "miraculously", "amazingly", "shockingly", "surprisingly",
      "huge", "tremendous", "massive", "enormous",
      "tiny", "insignificant", "minor",
      "always", "never",
      "everyone", "no one",
      "good", "bad", "right", "wrong",
      "lazy", "stupid", "ignorant",
      "brilliant", "genius", "expert"
    ];

    // const response = await web_fetch({ prompt: `Please fetch the text content of the page at this URL: ${url}` });
    // const content = response.content;

    // Simulated content for local development
    const content = "This is a sample text that contains some biased words like obviously and clearly. It is a brilliant article that is undoubtedly correct. Everyone should read it.";

    if (!content) {
      return NextResponse.json({ error: 'Could not fetch content from the URL' }, { status: 500 });
    }

    const words = content.toLowerCase().split(/\s+/);
    let biasCount = 0;
    const foundBiasedWords = new Set<string>();

    for (const word of words) {
      if (BIASED_WORDS.includes(word)) {
        biasCount++;
        foundBiasedWords.add(word);
      }
    }

    const biasScore = (biasCount / words.length) * 1000;
    const reasons = Array.from(foundBiasedWords).map(word => `The word "${word}" can be a sign of bias.`);

    if (reasons.length === 0) {
      reasons.push("No obvious signs of biased language were found.");
    }

    return NextResponse.json({ score: biasScore, reasons });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to analyze the URL' }, { status: 500 });
  }
}