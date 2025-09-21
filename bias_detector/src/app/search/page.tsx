"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import type {
  EvidenceItem,
  BiasAnalysis,
  JustificationSection,
} from "../../types/analysis";

interface PubMedResult {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  pubDate: string;
  abstract?: string;
  url: string;
}

interface Analysis {
  id: string;
  url: string;
  biasScore: string;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PubMedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BiasAnalysis | null>(null);
  const [analyzedStudyId, setAnalyzedStudyId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar state

  const { user, loading: authLoading } = useAuth();
  const [userAnalyses, setUserAnalyses] = useState<Analysis[]>([]); // State for user's analysis history
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [analysesError, setAnalysesError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // router.push('/login'); // Assuming you want to redirect if not logged in
    }
  }, [user, authLoading]);

  // Fetch user's analysis history
  useEffect(() => {
    const fetchUserAnalyses = async () => {
      if (!user) {
        setAnalysesLoading(false);
        return;
      }

      setAnalysesLoading(true);
      setAnalysesError(null);

      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/analyses", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user analyses.");
        }

        const data = await response.json();
        if (data.success) {
          setUserAnalyses(data.data);
        } else {
          throw new Error(
            data.error || "Unknown error fetching user analyses.",
          );
        }
      } catch (err) {
        setAnalysesError(
          err instanceof Error ? err.message : "An unknown error occurred.",
        );
      } finally {
        setAnalysesLoading(false);
      }
    };

    fetchUserAnalyses();
  }, [user]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const searchPubMed = async () => {
    if (!query.trim()) {
      setError("Please enter a search term.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // PubMed E-utilities API
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
        query,
      )}&retmax=10&retmode=json`;

      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.esearchresult?.idlist?.length) {
        setError("No results found for your search.");
        return;
      }

      const pmids = searchData.esearchresult.idlist.join(",");
      const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids}&retmode=xml`;

      const detailsResponse = await fetch(detailsUrl);
      const detailsText = await detailsResponse.text();

      const parsedResults = parsePubMedXML(detailsText);
      setResults(parsedResults);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  //i know it looks cursed lol but it's for good formatting
  //used claude to help me make this crazy XML parser
  const parsePubMedXML = (xmlText: string): PubMedResult[] => {
    const results: PubMedResult[] = [];

    const articleMatches =
      xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

    articleMatches.forEach((article) => {
      const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const titleMatch = article.match(
        /<ArticleTitle[^>]*>([^<]+)<\/ArticleTitle>/,
      );
      const authorMatches = article.match(
        /<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<ForeName>([^<]+)<\/ForeName>[\s\S]*?<\/Author>/g,
      );
      const journalMatch = article.match(/<Title>([^<]+)<\/Title>/);
      const dateMatch = article.match(
        /<PubDate[^>]*>[\s\S]*?<Year>(\d+)<\/Year>[\s\S]*?<\/PubDate>/,
      );
      const abstractMatch = article.match(
        /<AbstractText[^>]*>([^<]+)<\/AbstractText>/,
      );

      if (pmidMatch && titleMatch) {
        const pmid = pmidMatch[1];
        const authors = authorMatches
          ? authorMatches
              .slice(0, 3)
              .map((author) => {
                const lastMatch = author.match(/<LastName>([^<]+)<\/LastName>/);
                const firstMatch = author.match(
                  /<ForeName>([^<]+)<\/ForeName>/,
                );
                return lastMatch && firstMatch
                  ? `${firstMatch[1]} ${lastMatch[1]}`
                  : "";
              })
              .filter(Boolean)
              .join(", ")
          : "Unknown authors";

        results.push({
          pmid: pmid as string,
          title: titleMatch[1] ?? "Unknown title",
          authors,
          journal: journalMatch?.[1] ?? "Unknown journal",
          pubDate: dateMatch?.[1] ?? "Unknown date",
          abstract: abstractMatch ? abstractMatch[1] : undefined,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        });
      }
    });

    return results;
  };

  const analyzeStudy = async (result: PubMedResult) => {
    if (!user) {
      setError("Please log in to analyze studies.");
      return;
    }

    setAnalyzingId(result.pmid);
    setError(null);
    setAnalysis(null);
    setAnalyzedStudyId(null);

    try {
      const idToken = await user.getIdToken();

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ url: result.url }),
      });

      if (!analyzeRes.ok) {
        let msg = "Failed to analyze the study.";
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
          url: result.url,
          title: result.title,
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

      const saved = await saveRes.json();

      setAnalysis({
        biasScore: ai.biasScore,
        biasMeaning: ai.biasMeaning,
        justification: ai.justification,
      } as BiasAnalysis);

      setAnalyzedStudyId(result.pmid);

      if (saved?.success && saved?.data?.id) {
        setUserAnalyses((prev) => [
          ...prev,
          {
            id: saved.data.id,
            url: result.url,
            biasScore: ai.biasScore,
            createdAt: {
              _seconds: Math.floor(Date.now() / 1000),
              _nanoseconds: 0,
            },
          },
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setAnalyzingId(null);
    }
  };

  const SectionBlock = ({
    title,
    section,
  }: {
    title: string;
    section: JustificationSection;
  }) => {
    return (
      <div className="bg-white/5 p-4">
        <h6 className="mb-2 font-semibold">{title}</h6>
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
  };

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
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Medical Study Search
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Search for medical research studies and uncover any potential
            biases.
          </p>
        </div>

        <div className="w-full max-w-4xl">
          <div className="mb-8 flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for medical studies..."
                className="flex-1 bg-white/10 p-4 text-white placeholder:text-gray-400"
                onKeyDown={(e) => e.key === "Enter" && searchPubMed()}
              />
              <button
                onClick={searchPubMed}
                disabled={loading}
                className="bg-[#0A355E] p-4 font-bold text-white disabled:opacity-70"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <Link
              href="/"
              className="text-center text-white/70 transition-colors hover:text-white"
            >
              ← Back to URL Analysis
            </Link>
          </div>

          {error && <p className="mb-4 text-red-500">{error}</p>}

          {results.length > 0 && (
            <div className="mb-8 space-y-4">
              <h2 className="text-2xl font-bold">Search Results</h2>
              {results.map((result) => (
                <div key={result.pmid} className="bg-white/10 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="mb-2 text-xl font-bold">{result.title}</h3>
                      <p className="mb-2 text-white/70">
                        <strong>Authors:</strong> {result.authors}
                      </p>
                      <p className="mb-2 text-white/70">
                        <strong>Journal:</strong> {result.journal} (
                        {result.pubDate})
                      </p>
                      {result.abstract && (
                        <p className="mb-3 line-clamp-3 text-white/80">
                          {result.abstract}
                        </p>
                      )}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        View on PubMed →
                      </a>
                    </div>
                    <button
                      onClick={() => analyzeStudy(result)}
                      disabled={analyzingId === result.pmid}
                      className="bg-[#0A355E] px-4 py-2 font-bold whitespace-nowrap text-white hover:bg-white disabled:opacity-70"
                    >
                      {analyzingId === result.pmid ? "Analyzing..." : "Analyze"}
                    </button>
                  </div>

                  {/* Inline Analysis Results */}
                  {analyzedStudyId === result.pmid && analysis && (
                    <div className="mt-6 border-t border-white/20 pt-6">
                      <h4 className="mb-4 text-xl font-bold">
                        Analysis Results
                      </h4>
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg">
                            <span className="font-bold">Bias Score:</span>{" "}
                            {analysis.biasScore}
                          </p>
                          <p className="text-white/80">
                            ({analysis.biasMeaning})
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <SectionBlock
                            title="Sample Representation"
                            section={
                              analysis.justification.sampleRepresentation
                            }
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
                            section={
                              analysis.justification.methodologicalFairness
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* User Analysis History Section */}
        </div>
      </div>
    </main>
  );
}
