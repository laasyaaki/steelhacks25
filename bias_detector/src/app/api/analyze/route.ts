import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//i used claude for this craziness
function extractJson(text: string) {
  if (!text) return "";
  let t = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  t = t
    .replace(/^<json>/i, "")
    .replace(/<\/json>$/i, "")
    .trim();

  const m = t.match(/\{[\s\S]*\}/);
  return m ? m[0] : t;
}

async function callModelWithTools(url: string, reformulateFrom?: string) {
  const tools = [{ urlContext: {} }, { googleSearch: {} }];
  const model = "gemini-2.5-flash";

  const systemRules = `
You are a STRICT JSON generator.
Output ONLY valid, minified JSON (no markdown, no backticks, no comments, no trailing commas).
Begin with { and end with }.
Schema:
{
  "biasScore": "number",
  "biasMeaning": "string",
  "justification": {
    "sampleRepresentation": {
      "summary": "string",
      "evidence": [
        {
          "quote": "string",
          "section": "string"
        }
      ]
    },
    "inclusionInAnalysis": {
      "summary": "string",
      "evidence": [
        {
          "quote": "string",
          "section": "string"
        }
      ]
    },
    "studyOutcomes": {
      "summary": "string",
      "evidence": [
        {
          "quote": "string",
          "section": "string"
        }
      ]
    },
    "methodologicalFairness": {
      "summary": "string",
      "evidence": [
        {
          "quote": "string",
          "section": "string"
        }
      ]
    }
  }
}
`.trim();

  const task = reformulateFrom
    ? `Reformat the following answer into STRICT JSON ONLY, adhering to the schema. Do not add any text outside JSON:\n\n${reformulateFrom}`
    : `Task: "Is this biased?"
Objective:
For the article at ${url}, calculate a gender bias score and provide a detailed justification for that score, following the specified schema and rules.

Error Handling Rules:
If the article content appears unreadable or inaccessible:
"The article content appears unreadable or inaccessible at this moment. Please ensure the text is clear and try again."
If the article is not a medical research article:
"This tool is optimized for analyzing medical research articles where specific types of bias may occur. Non-medical research content cannot be processed."
If there is insufficient gender-specific data to make a judgment:
"Insufficient gender-specific data is present within the article to conduct a thorough analysis of gender bias. Please ensure relevant demographic and analytical details are provided."

Descriptions for Bias Scores (for biasMeaning field):
Bias Score 1: Not Biased
Description: Gender representation is balanced or accurately reflects the population; both genders are included and analyzed equitably.


Bias Score 2: Minor Bias
Description: Slight gender imbalance in the sample, acknowledged as a minor limitation; unlikely to significantly impact main conclusions.


Bias Score 3: Moderate Bias
Description: Noticeable gender imbalance, potentially affecting generalizability to the broader population; implications not fully addressed.


Bias Score 4: Significant Bias
Description: Pronounced gender disparity, making findings largely applicable to only one gender; generalization to the underrepresented gender is unreliable.


Bias Score 5: Severe Bias / Exclusionary
Description: One gender is almost entirely or completely excluded, rendering findings applicable solely to the studied gender.


Return STRICT JSON ONLY.`;

  const contents = [
    { role: "user", parts: [{ text: systemRules }] },
    { role: "user", parts: [{ text: task }] },
  ];

  return ai.models.generateContent({
    model,
    contents,
    config: {
      tools,
      temperature: 0.3,
    },
  });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    //attempt uno
    const res1 = await callModelWithTools(url);
    if (!res1.candidates?.length) {
      return NextResponse.json(
        { error: "No candidates returned..." },
        { status: 502 },
      );
    }

    const parts = res1.candidates[0]?.content?.parts ?? [];
    const combined =
      parts.map((p: any) => p.text ?? p.stringValue ?? "").join("\n") ||
      res1.text ||
      "";

    let jsonText = extractJson(combined);
    try {
      const parsed = JSON.parse(jsonText);
      const grounding = res1.candidates?.[0]?.groundingMetadata ?? null;
      const urlMeta = (res1.candidates?.[0] as any)?.urlContextMetadata ?? null;
      return NextResponse.json({ ...parsed, debug: { grounding, urlMeta } });
    } catch {
      //jsonrepair pls save us
      try {
        const repaired = jsonrepair(jsonText);
        const parsed = JSON.parse(repaired);
        const grounding = res1.candidates?.[0]?.groundingMetadata ?? null;
        const urlMeta =
          (res1.candidates?.[0] as any)?.urlContextMetadata ?? null;
        return NextResponse.json({ ...parsed, debug: { grounding, urlMeta } });
      } catch {
        //attemp dos
        const res2 = await callModelWithTools(url, combined);
        const parts2 = res2.candidates?.[0]?.content?.parts ?? [];
        const combined2 =
          parts2.map((p: any) => p.text ?? p.stringValue ?? "").join("\n") ||
          res2.text ||
          "";
        let jsonText2 = extractJson(combined2);

        try {
          const parsed2 = JSON.parse(jsonText2);
          const grounding = res2.candidates?.[0]?.groundingMetadata ?? null;
          const urlMeta =
            (res2.candidates?.[0] as any)?.urlContextMetadata ?? null;
          return NextResponse.json({
            ...parsed2,
            debug: { grounding, urlMeta },
          });
        } catch {
          try {
            const repaired2 = jsonrepair(jsonText2);
            const parsed2 = JSON.parse(repaired2);
            const grounding = res2.candidates?.[0]?.groundingMetadata ?? null;
            const urlMeta =
              (res2.candidates?.[0] as any)?.urlContextMetadata ?? null;
            return NextResponse.json({
              ...parsed2,
              debug: { grounding, urlMeta },
            });
          } catch {
            return NextResponse.json(
              { error: "Invalid json from model", raw: combined2 },
              { status: 502 },
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to analyze", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
