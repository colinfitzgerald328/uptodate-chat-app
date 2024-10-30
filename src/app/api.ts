"use server";
// const API_URL = "https://athletics-hub-engine-production.up.railway.app";
const GO_SERVER_URL = "https://go-server-production-a4d6.up.railway.app";
import * as DDG from "duck-duck-scrape";

export interface GetContextPayload {
  current_question: string;
  chat_history: string[];
}

export interface GoogleSearchResponse {
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

export interface SearchResultItem {
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

export interface LinkScrapeResponse {
  url: string;
  content: string;
}

export interface ContextResponse {
  context: string;
  processing_time: number;
}

export const fetchAIContext = async (question: string) => {
  const response = await fetch(GO_SERVER_URL + "/context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,}),
  });
  return await response.json() as ContextResponse;
};

export const fetchResults = async (searchQuery: string) => {
  const searchResults = await DDG.search(searchQuery, {
    safeSearch: DDG.SafeSearchType.STRICT,
  });
  return searchResults;
};

export const fetchContentFromLink = async (link: string) => {
  const response = await fetch(GO_SERVER_URL + "/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: link }),
  });
  return (await response.json()) as LinkScrapeResponse;
};

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyA5tfuXTZusFLpo-G5Xp1casq_aypzUdoY");

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 2,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      response: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.STRING,
        },
      },
    },
  },
};

export interface ModelResponse {
  response: string[];
}

export const getQueriesFromMessages = async (messages: string[]) => {
  const chatSession = model.startChat({
    generationConfig,
  });

  const prompt = `please generate a list of queries to search google based on the user's chat messages.
  this context will be used for your next question to help give you the answer so please make sure the queries
  are as good as you can make them.
  for general context, the current year is 2024 and the user's geolocation is the United States of America

  <chat_history>
    ${messages}
  </chat_history>

  <current_question>
    ${messages[messages.length - 1]}
  </current_question>
  `;

  console.log("PROMPT", prompt);

  const result = await chatSession.sendMessage(prompt);
  if (!result?.response?.candidates) {
    return null;
  }
  return result.response.candidates[0].content.parts[0].text;
};


