const GO_SERVER_URL = "https://go-server-production-a4d6.up.railway.app";

export interface GetContextPayload {
  current_question: string;
  chat_history: string[];
}

export interface ContextResponse {
  context: string;
  processing_time: number;
}

export const fetchAIContext = async (payload: GetContextPayload) => {
  const response = await fetch(GO_SERVER_URL + "/context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      { current_question: payload.current_question, chat_history: payload.chat_history }),
  });
  return await response.json() as ContextResponse;
};









