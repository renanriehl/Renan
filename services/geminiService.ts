import { GoogleGenAI } from "@google/genai";

export const isGeminiConfigured = !!process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (isGeminiConfigured) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

/**
 * Converts a File object to a Base64 string suitable for the Gemini API.
 */
const fileToPart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generates a technical description for an image using Gemini.
 */
export const generateImageDescription = async (file: File): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API not configured.");
    return "";
  }

  try {
    const imagePart = await fileToPart(file);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          imagePart,
          {
            text: "Descreva brevemente esta imagem para um relatório técnico formal de vistoria escolar. Seja direto e objetivo. Máximo de 20 palavras. Responda em Português do Brasil.",
          },
        ],
      },
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Erro ao gerar descrição com Gemini:", error);
    return ""; // Return empty string on failure to not block the UI
  }
};