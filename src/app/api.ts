
const API_URL = "https://athletics-hub-engine-production.up.railway.app";

export const fetchAIContext = async (input: string) => {
    const response = await fetch(API_URL + `/context?user_question=${encodeURIComponent(input)}`);
    return await response.json();
}
