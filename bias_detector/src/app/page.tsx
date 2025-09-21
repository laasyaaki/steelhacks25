"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<{
    score: number;
    justification: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user, signOutUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1C4073] to-[#43658C] text-white">
        <p>Loading user session...</p>
      </div>
    );
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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
      const simulatedScore = Math.floor(Math.random() * 100);
      const simulatedJustification = `This is a simulated justification for bias score ${simulatedScore}%.`;

      const idToken = await user.getIdToken();
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          url,
          biasScore: simulatedScore,
          justification: simulatedJustification,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze and save the URL.");
      }

      const data = await response.json();
      if (data.success) {
        setAnalysis({
          score: simulatedScore,
          justification: simulatedJustification,
        });
      } else {
        throw new Error(data.error || "Unknown error saving analysis.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#1C4073] to-[#43658C] text-white">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="absolute top-4 left-4 z-10">
        <button onClick={toggleSidebar} className="text-white focus:outline-none">
          <svg
            className="w-8 h-8"
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
      {/* Moved Auth buttons to top right */}
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
          <Link href="/login" className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
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
        <div className="w-full max-w-2xl">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL of a medical study..."
              className="bg-white/10 p-4 text-white placeholder:text-gray-400"
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
