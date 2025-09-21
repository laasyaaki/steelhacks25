export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function emptySection() {
  return {
    summary: "",
    evidence: [] as Array<{ quote: string; section: string }>,
  };
}
function normalizeSchema(raw: any) {
  const out: any = {};

  const bs = raw?.biasScore;
  out.biasScore =
    typeof bs === "string" ? bs : Number.isFinite(Number(bs)) ? String(bs) : "";
  out.biasMeaning = typeof raw?.biasMeaning === "string" ? raw.biasMeaning : "";

  const j = raw?.justification ?? {};
  const sr = j?.sampleRepresentation ?? {};
  const ia = j?.inclusionInAnalysis ?? {};
  const so = j?.studyOutcomes ?? {};
  const mf = j?.methodologicalFairness ?? {};

  const fixSection = (s: any) => ({
    summary: typeof s?.summary === "string" ? s.summary : "",
    evidence: Array.isArray(s?.evidence)
      ? s.evidence
          .filter(
            (e: any) =>
              e &&
              (typeof e.quote === "string" || typeof e.section === "string"),
          )
          .map((e: any) => ({
            quote: typeof e.quote === "string" ? e.quote : "",
            section: typeof e.section === "string" ? e.section : "",
          }))
      : [],
  });

  out.justification = {
    sampleRepresentation: fixSection(sr),
    inclusionInAnalysis: fixSection(ia),
    studyOutcomes: fixSection(so),
    methodologicalFairness: fixSection(mf),
  };

  return out;
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
  "biasScore": "string",
  "biasMeaning": "string",
  "justification": {
    "sampleRepresentation": {
      "summary": "string",
      "evidence": [{"quote":"string","section":"string"}]
    },
    "inclusionInAnalysis": {
      "summary": "string",
      "evidence": [{"quote":"string","section":"string"}]
    },
    "studyOutcomes": {
      "summary": "string",
      "evidence": [{"quote":"string","section":"string"}]
    },
    "methodologicalFairness": {
      "summary": "string",
      "evidence": [{"quote":"string","section":"string"}]
    }
  }
}
Rules:
- "biasScore" MUST be a string (e.g., "1", "2", "3", "4", or "5").
- Do not include any text outside JSON.`.trim();

  const task = reformulateFrom
    ? `Reformat the following answer into STRICT JSON ONLY, adhering to the schema. Do not add any text outside JSON:\n\n${reformulateFrom}`
    : `Task: "Is this biased?"
For the article at ${url}, calculate a gender bias score and provide a detailed justification for that score, following the specified schema and rules.

Error Handling Rules:
If the article content appears unreadable or inaccessible:
"The article content appears unreadable or inaccessible at this moment. Please ensure the text is clear and try again."
If the article is not a medical research article:
"This tool is optimized for analyzing medical research articles where specific types of bias may occur. Non-medical research content cannot be processed."
If there is insufficient gender-specific data to make a judgment:
"Insufficient gender-specific data is present within the article to conduct a thorough analysis of gender bias. Please ensure relevant demographic and analytical details are provided."

Descriptions for Bias Scores (for biasMeaning field):
1: Not Biased
2: Minor Bias
3: Moderate Bias
4: Significant Bias
5: Severe Bias / Exclusionary

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
    const attempt = async (res: any) => {
      const parts = res?.candidates?.[0]?.content?.parts ?? [];
      const combined =
        parts.map((p: any) => p.text ?? p.stringValue ?? "").join("\n") ||
        res?.text ||
        "";
      const grounding = res?.candidates?.[0]?.groundingMetadata ?? null;
      const urlMeta = (res?.candidates?.[0] as any)?.urlContextMetadata ?? null;

      let jsonText = extractJson(combined);

      try {
        const parsed = JSON.parse(jsonText);
        const normalized = normalizeSchema(parsed);
        return NextResponse.json({
          ...normalized,
          debug: { grounding, urlMeta },
        });
      } catch {
        //attempt dos
        try {
          const repaired = jsonrepair(jsonText);
          const parsed = JSON.parse(repaired);
          const normalized = normalizeSchema(parsed);
          return NextResponse.json({
            ...normalized,
            debug: { grounding, urlMeta },
          });
        } catch (e) {
          return { error: true, combined, e };
        }
      }
    };

    const res1 = await callModelWithTools(url);
    if (!res1?.candidates?.length) {
      return NextResponse.json(
        { error: "No candidates returned from model." },
        { status: 502 },
      );
    }
    const out1 = await attempt(res1);
    if (!(out1 as any).error) return out1 as NextResponse;

    const combined1 = (out1 as any).combined;
    const res2 = await callModelWithTools(url, combined1);
    if (!res2?.candidates?.length) {
      return NextResponse.json(
        { error: "No candidates returned (reformat pass)." },
        { status: 502 },
      );
    }
    const out2 = await attempt(res2);
    if (!(out2 as any).error) return out2 as NextResponse;

    return NextResponse.json(
      {
        error: "Invalid JSON from model after two attempts.",
        rawFirstPass: (out1 as any).combined,
        rawSecondPass: (out2 as any).combined,
      },
      { status: 502 },
    );
  } catch (err: any) {
    console.error("analyze route error:", err);
    return NextResponse.json(
      { error: "Failed to analyze", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
