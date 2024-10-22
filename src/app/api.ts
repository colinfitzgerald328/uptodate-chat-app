
const API_URL = "https://athletics-hub-engine-production.up.railway.app";

interface GetContextPayload {
    current_question: string;
    chat_history: string[];
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
