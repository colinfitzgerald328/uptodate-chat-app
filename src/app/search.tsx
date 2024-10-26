"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input"
import { fetchLinksFromGoogle } from './api';

// Define the structure of a search result item
interface SearchItem {
  title: string;
  link: string;
  snippet: string;
}

// Define the props for our component
interface GoogleSearchProps {
  apiKey: string;
  cx: string;
}


export default function GoogleSearch({ apiKey, cx }: GoogleSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce function to limit API calls
  const debounce = (func: (...args: string[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: string[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetchLinksFromGoogle(searchQuery, apiKey, cx)

    await fetch("https://go-server-production-a4d6.up.railway.app/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls: response.items.map((item) => item.link) }),
    })
    


  }, [apiKey, cx]);    

  // Debounced search function
  const debouncedSearch = useCallback(debounce(performSearch, 300), [performSearch]);

  // Effect to trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-4">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          aria-label="Search query"
          className="w-full p-2 border rounded"
        />
      </div>
      
      {isLoading && <p className="text-center">Loading...</p>}
      
      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((item, index) => (
            <div key={index} className="border-b pb-2">
              <h3 className="text-xl font-semibold">
                <a href={item.link} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h3>
              <p className="text-sm text-gray-600">{item.snippet}</p>
            </div>
          ))}
        </div>
      )}
      
      {query && !isLoading && results.length === 0 && (
        <p className="text-center">No results found.</p>
      )}
    </div>
  );
}