import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, userApiKey } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Gemini API Key. Please provide one in the AI Settings.' }, { status: 401 });
    }

    // Initialize Gemini SDK
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a highly accurate receipt parsing AI for a pirate-themed bill splitting app.
Analyze this receipt image and extract the following:
1. "amount": The final total amount on the receipt (number only, no currency symbols). If unsure, make your best guess.
2. "description": A short, nautical/pirate themed description of what was purchased (e.g., "Supplies at the Tavern", "Ship Repairs", "Rations"). Maximum 5 words.
3. "category": Choose exactly one from this list: "food", "drinks", "activities", "shopping", "transport", "other".

Return ONLY a valid JSON object matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["amount", "description", "category"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response from Gemini');
    }

    const result = JSON.parse(text);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    return NextResponse.json({ error: error.message || 'Failed to scan receipt' }, { status: 500 });
  }
}
