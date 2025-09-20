import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  "biasScore": number,
  "verdict": "No issue" | "Possible gender-generalization bias" | "Likely gender-generalization bias",
  "rationale": string,
  "evidence": [{"quote": string, "section"?: string}],
  "citations": [{"title"?: string, "uri": string}]
}
`.trim();

  const task = reformulateFrom
    ? `Reformat the following answer into STRICT JSON ONLY, adhering to the schema. Do not add any text outside JSON:\n\n${reformulateFrom}`
    : `Task: "Is this biased?"
Analyze the study at ${url}.
Focus on participants' sex/gender distribution and whether conclusions over-generalize beyond the sampled gender.

Rules:
- Extract sex/gender counts or state if missing.
- If one sex ≥ 80% AND conclusions generalize to "people/patients/everyone" without explicit sex limitation → bias.
- Score:
  80 = clear over-generalization with ≥80% single-sex
  60 = 60-79% skew + generalization
  40 = generalization with near-balanced sample
  20 = balanced with no issue
  10 = authors clearly limit scope to sampled sex
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
