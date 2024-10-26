const API_URL = "https://athletics-hub-engine-production.up.railway.app";

interface GetContextPayload {
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


export const fetchAIContext = async (payload: GetContextPayload) => {
    const response = await fetch(API_URL + "/context", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    return await response.json();
}


export const fetchLinksFromGoogle = async (searchQuery: string, apiKey: string, cx: string) => {
  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}`
  );

  // Check if the response is OK (status code 200)
  if (!response.ok) {
    throw new Error(`Error fetching search results: ${response.statusText}`);
  }

  // Parse and return the JSON response, typed as GoogleSearchResponse
  return await response.json() as GoogleSearchResponse;
}

