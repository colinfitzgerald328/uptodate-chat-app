const API_URL = "https://athletics-hub-engine-production.up.railway.app";
const GO_SERVER_URL = "https://go-server-production-a4d6.up.railway.app";

interface GetContextPayload {
  current_question: string;
  chat_history: string[];
}

interface fetchResponse {
  url: string;
  content: string;
  error: string;
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

export const fetchAIContext = async (payload: GetContextPayload) => {
  const response = await fetch(API_URL + "/context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return await response.json();
};

export const fetchLinksFromGoogle = async (
  searchQuery: string,
  apiKey: string,
  cx: string,
) => {
  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}`,
  );

  // Check if the response is OK (status code 200)
  if (!response.ok) {
    throw new Error(`Error fetching search results: ${response.statusText}`);
  }

  // Parse and return the JSON response, typed as GoogleSearchResponse
  return (await response.json()) as GoogleSearchResponse;
};

export const fetchContentFromLinks = async (links: string[]) => {
  const response = await fetch(GO_SERVER_URL + "/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ urls: links }),
  });
  return (await response.json()) as fetchResponse[];
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
  const basePrompt = {
    role: "user",
    parts: [
      {
        text: "please generate a list of queries to search google based on the user's chat messages. this context will be used for your next question to help give you the answer so please make sure the queries are as good as you can make them.  for general context, the current year is 2024 and the user's geolocation is the United States of America",
      },
    ],
  };
  const messagesHistory = [
    basePrompt,
    ...messages.map((message) => {
      return {
        role: "user",
        parts: [{ text: message }],
      };
    }),
  ];
  const chatSession = model.startChat({
    generationConfig,
    history: messagesHistory.slice(0, messagesHistory.length - 1),
  });

  const result = await chatSession.sendMessage(messages[messages.length - 1]);
  if (!result?.response?.candidates) {
    return null;
  }
  return result.response.candidates[0].content.parts[0].text;
};
