"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import type { JustificationSection, BiasAnalysis } from "../types/analysis";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<BiasAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user, signOutUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1C4073] to-[#43658C] text-white">
        <p>Loading user session...</p>
      </div>
    );
  }

  const toggleSidebar = () => setSidebarOpen((s) => !s);

  const handleAnalyze = async () => {
    if (!url) {
      setError("Please enter a URL.");
      return;
    }
    try {
      // Throws if invalid
      const parsed = new URL(url);
      if (!/^https?:/i.test(parsed.protocol)) throw new Error();
    } catch {
      setError("Please enter a valid URL (including http/https).");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const idToken = await user.getIdToken();

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!analyzeRes.ok) {
        let msg = "Failed to analyze the URL.";
        try {
          const maybe = await analyzeRes.json();
          if (maybe?.error) msg = maybe.error;
        } catch {}
        throw new Error(msg);
      }

      const ai = (await analyzeRes.json()) as BiasAnalysis & {
        debug?: unknown;
      };

      const saveRes = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          url,
          biasScore: ai.biasScore,
          biasMeaning: ai.biasMeaning,
          justification: ai.justification,
        }),
      });

      if (!saveRes.ok) {
        let msg = "Failed to save the analysis.";
        try {
          const maybe = await saveRes.json();
          if (maybe?.error) msg = maybe.error;
        } catch {}
        throw new Error(msg);
      }

      setAnalysis({
        biasScore: ai.biasScore,
        biasMeaning: ai.biasMeaning,
        justification: ai.justification,
      });
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
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={toggleSidebar}
          className="text-white focus:outline-none"
        >
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
          </svg>
        </button>
      </div>

      {/* Auth buttons top-right */}
      <div className="absolute top-8 right-4 z-10 flex items-center gap-4">
        {user ? (
          <>
            <p className="text-white/80">Welcome, {user.email}</p>
            <button
              onClick={signOutUser}
              className="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Login / Register
          </Link>
        )}
      </div>

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
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
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
