"use client";

import { useState } from "react";
import Link from "next/link";
import type { JustificationSection, BiasAnalysis } from "~/types/analysis";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<BiasAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url) {
      setError("Please enter a URL.");
      return;
    }
    try {
      const checkUrl = new URL(url);
    } catch (err) {
      setError("Please enter valid URL.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        let msg = "Failed to analyze the URL.";
        try {
          const maybe = await response.json();
          if (maybe?.error) msg = maybe.error;
        } catch {}
        throw new Error(msg);
      }

      const data: BiasAnalysis = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  const SectionBlock = ({
    title,
    section,
  }: {
    title: string;
    section: JustificationSection;
  }) => (
    <div className="bg-white/5 p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="mb-3 text-white/80">{section.summary}</p>
      {section.evidence?.length > 0 && (
        <div className="space-y-2">
          {section.evidence.map((ev, i) => (
            <div key={i} className="bg-white/5 p-3">
              <p className="text-sm italic">"{ev.quote}"</p>
              {ev.section && (
                <p className="mt-1 text-xs text-white/60">
                  Section: {ev.section}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#1C4073] to-[#43658C] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            The Bias Lens
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Uncover potential bias in medical research papers and articles.
            Paste a URL to analyze the text for common indicators of bias.
          </p>
        </div>
        <div className="w-full">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL of a medical study..."
              className="bg-white/10 p-4 text-white placeholder:text-gray-400"
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
            <div className="flex gap-4">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-1 bg-[#0A355E] p-4 font-bold text-white hover:bg-white disabled:opacity-70"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
            <Link
              href="/search"
              className="text-center text-white/70 transition-colors hover:text-white"
            >
              Search for Topics Instead →
            </Link>
          </div>
          {error && <p className="mt-4 text-red-500">{error}</p>}
          {analysis && (
            <div className="mt-8 w-full bg-white/10 p-6">
              <h2 className="text-3xl font-bold">Analysis Results</h2>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg">
                    <span className="font-bold">Bias Score:</span>{" "}
                    {analysis.biasScore}
                  </p>
                  <p className="text-white/80">({analysis.biasMeaning})</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SectionBlock
                    title="Sample Representation"
                    section={analysis.justification.sampleRepresentation}
                  />
                  <SectionBlock
                    title="Inclusion in Analysis"
                    section={analysis.justification.inclusionInAnalysis}
                  />
                  <SectionBlock
                    title="Study Outcomes"
                    section={analysis.justification.studyOutcomes}
                  />
                  <SectionBlock
                    title="Methodological Fairness"
                    section={analysis.justification.methodologicalFairness}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
