import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { location, budget, userApiKey } = await request.json();

    if (!location || !budget) {
      return NextResponse.json({ error: 'Location and budget are required.' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Mock fallback if API key is not provided
      console.warn('No GEMINI_API_KEY found. Returning mock data.');
      return NextResponse.json({
        destinations: [
          {
            name: 'Tropical Atoll Retreat',
            cost: `₹${(Number(budget) * 0.8).toFixed(2)}`,
            reason: 'Perfect pristine beaches with affordable luxury, just a short voyage from your current coordinates.',
            icon: 'beach_access'
          },
          {
            name: 'Historic Port City',
            cost: `₹${(Number(budget) * 0.6).toFixed(2)}`,
            reason: 'Rich in naval history and culture. Ideal for the discerning traveler on a moderate budget.',
            icon: 'account_balance'
          },
          {
            name: 'Mountain Fjord Cruise',
            cost: `₹${(Number(budget) * 0.95).toFixed(2)}`,
            reason: 'A breathtaking scenic experience maximizing your budget for an unforgettable journey.',
            icon: 'landscape'
          }
        ]
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an expert travel agent. The user is currently located at or near: "${location}".
Their total travel budget is: "${budget}".
Suggest exactly 3 great vacation destinations that they could realistically visit given their location and budget. 
Provide a JSON array of objects. Each object must have exactly these keys:
- "name": (string) The name of the destination.
- "cost": (string) The estimated cost formatted nicely.
- "reason": (string) A short 1-2 sentence pitch explaining why it's a good fit for their location and budget.
- "icon": (string) A Google Material Symbols icon name that best represents the destination (e.g., "beach_access", "landscape", "location_city", "hiking", "sailing").

Return ONLY valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const jsonText = response.text || '[]';
    let destinations = [];
    try {
      destinations = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse Gemini response', jsonText, error);
      destinations = [];
    }

    return NextResponse.json({ destinations });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate suggestions.' }, { status: 500 });
  }
}
