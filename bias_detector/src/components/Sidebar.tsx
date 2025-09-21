"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface Analysis {
  id: string;
  url: string;
  biasScore: number;
  justification: string; // Added justification
  title?: string; // Added title (optional)
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/analyses', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analyses.');
        }

        const data = await response.json();
        if (data.success) {
          setAnalyses(data.data);
        } else {
          throw new Error(data.error || 'Unknown error fetching analyses.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [user]);

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 text-white transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Your Analyses</h2>
        <button onClick={toggleSidebar} className="text-gray-400 hover:text-white">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
      <div className="p-4">
        {loading && <p>Loading analyses...</p>}
        {error && <p className="text-red-400">Error: {error}</p>}
        {!user && <p>Please log in to view your analyses.</p>}
        {user && analyses.length === 0 && !loading && !error && (
          <p>No analyses yet. Analyze a link to see your history!</p>
        )}
        {user && analyses.length > 0 && (
          <ul>
            {analyses.map((analysis) => (
              <li key={analysis.id} className="mb-2 p-2 rounded-md bg-gray-700">
                <p className="text-sm font-semibold truncate">{analysis.title || analysis.url}</p>
                <a href={analysis.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline block text-xs truncate">
                  {analysis.url}
                </a>
                <p className="text-sm">Bias Score: {analysis.biasScore.toFixed(2)}%</p>
                {/* Removed justification display */}
                <p className="text-xs text-gray-400">
                  {new Date(analysis.createdAt._seconds * 1000).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
