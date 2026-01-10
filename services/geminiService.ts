
import { GoogleGenAI } from "@google/genai";
import { InsightResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Persistent-ish cache for the session to prevent 429 errors from redundant clicks
const insightCache = new Map<string, { data: InsightResponse, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Global rate limiting to prevent spamming the API too fast
let lastRequestTimestamp = 0;
const MIN_REQUEST_SPACING = 2000; // 2 seconds between any calls

/**
 * Generates market insights for crypto price movements using Google Search grounding.
 * Implements aggressive caching and spacing to mitigate "RESOURCE_EXHAUSTED" rate limit errors.
 */
export async function getMarketInsight(symbol: string, change: number, price: number): Promise<InsightResponse> {
  const cacheKey = `${symbol.toUpperCase()}_INSIGHT`;
  const now = Date.now();
  
  // 1. Check Cache
  const cached = insightCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Serving cached insight for ${symbol}`);
    return cached.data;
  }

  // 2. Global spacing check (throttling)
  const timeSinceLastRequest = now - lastRequestTimestamp;
  if (timeSinceLastRequest < MIN_REQUEST_SPACING) {
    // If we're clicking too fast, just wait a bit or return a placeholder
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_SPACING - timeSinceLastRequest));
  }

  try {
    lastRequestTimestamp = Date.now();
    const direction = change >= 0 ? "surge" : "crash";
    const prompt = `The cryptocurrency ${symbol} is showing significant activity. Current price is ${price}. 
    Use Google Search to find any recent breaking news, liquidations, or social media trends (X/Twitter, Reddit) related to ${symbol} that could explain recent price action. 
    Provide a concise, 2-sentence market insight summary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.5, // Lower temperature for more consistent results
      },
    });

    const text = response.text || "No specific news found. Likely driven by technical factors or broader market sentiment.";
    
    const sources: { title: string; uri: string }[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
          });
        }
      });
    }

    const result = { text, sources };
    
    // Save to cache
    insightCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error: any) {
    console.error("Gemini Insight Error:", error);
    
    // Explicit 429 handling
    if (error?.message?.includes("RESOURCE_EXHAUSTED") || error?.status === 429) {
      return {
        text: "AI Quota reached. Please wait a moment. The system is still monitoring technical volatility in the background.",
        sources: []
      };
    }

    return {
      text: "Market insight currently unavailable. Monitor the price chart for technical confirmation.",
      sources: []
    };
  }
}
