"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<{
    score: number;
    justification: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url) {
      setError("Please enter a URL.");
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
        throw new Error("Failed to analyze the URL.");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
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
        <div className="w-full max-w-2xl">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL of a research study..."
              className="rounded-md bg-white/10 p-4 text-white placeholder:text-gray-400"
            />
            <div className="flex gap-4">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-1 rounded-md bg-[hsl(280,100%,70%)] p-4 font-bold text-white hover:bg-[hsl(280,100%,60%)] disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
              <Link
                href="/search"
                className="rounded-md bg-white/10 p-4 font-bold text-white transition-colors hover:bg-white/20"
              >
                Search instead
              </Link>
            </div>
          </div>
          {error && <p className="mt-4 text-red-500">{error}</p>}
          {analysis && (
            <div className="mt-8 rounded-xl bg-white/10 p-6">
              <h2 className="text-3xl font-bold">Analysis Results</h2>
              <div className="mt-4">
                <p className="text-lg">
                  <span className="font-bold">Bias Score:</span>{" "}
                  {analysis?.score !== undefined
                    ? analysis.score.toFixed(2)
                    : "N/A"}
                  %
                </p>
                <h3 className="mt-4 text-xl font-bold">Justification:</h3>
                <p>{analysis?.score}</p>
                <p>{analysis?.justification}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
