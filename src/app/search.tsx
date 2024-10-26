"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input"

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

interface GoogleSearchResponse {
    kind: string;
    url: {
      type: string;
      template: string;
    };
    queries: {
      request: SearchRequest[];
      nextPage: SearchRequest[];
    };
    context: {
      title: string;
    };
    searchInformation: {
      searchTime: number;
      formattedSearchTime: string;
      totalResults: string;
      formattedTotalResults: string;
    };
    items: SearchResultItem[];
  }
  
  interface SearchRequest {
    title: string;
    totalResults: string;
    searchTerms: string;
    count: number;
    startIndex: number;
    inputEncoding: string;
    outputEncoding: string;
    safe: string;
    cx: string;
  }
  
  interface SearchResultItem {
    kind: string;
    title: string;
    htmlTitle: string;
    link: string;
    displayLink: string;
    snippet: string;
    htmlSnippet: string;
    formattedUrl: string;
    htmlFormattedUrl: string;
    pagemap?: {
      cse_thumbnail?: {
        src: string;
        width: string;
        height: string;
      }[];
      metatags?: Record<string, string>[];
      cse_image?: {
        src: string;
      }[];
    };
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

    

    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const data: GoogleSearchResponse = await response.json();
      await Promise.all(data.items.map(async (item) => {
        await fetch(item.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
          },
        });
        const html = await response.text();
        item.snippet = html.match(/<p>(.*?)<\/p>/)?.[1] || '';
      }))
      setResults(data.items || []);
    } catch (err) {
      setError('An error occurred while fetching search results. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
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