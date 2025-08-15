import sleep from '../utils/sleep';
import {Page} from 'puppeteer';
import GenerativeAIService from '../services/generativeAI';
import * as fs from 'fs';

interface Trend {
  title: string;
  url: string;
}

const genAIService = new GenerativeAIService();

function getRecentTrends(): string[] {
  const path = './usedTrends.json';
  if (!fs.existsSync(path)) return [];
  return JSON.parse(fs.readFileSync(path, 'utf-8')).slice(0, 7);
}

async function getBestTitleFromTopTrends(trends: Trend[]): Promise<{
  title: string;
  index: number;
}> {
  const top10Trends = trends.slice(0, 10);
  const recentTrends = getRecentTrends();

  const prompt = `
You are an expert at spotting the best trending topic to write about on social media in Kenya. 

Below are 15 trending topics:
${top10Trends.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}

Avoid these recent trends: ${recentTrends.map((rt, i) => `${i + 1}. ${rt}`).join('\n')}

Rules:
- Ignore titles that are promotional, branded, religious, or previously used ${recentTrends.map((rt, i) => `${i + 1}. ${rt}`).join('\n')}.
- Choose the most engaging, newsworthy, or viral-friendly title for mass audience content.
- Your job is to pick **only one** from the list and ensure to avoid previously used trends.

Now reply ONLY with the number (1–15) of the trend you recommend. No explanation.`;

  const result = await genAIService['model'].generateContent(prompt);
  const response = result.response;
  const answer = response.text().trim();
  const chosenIndex = parseInt(answer) - 1;

  if (
    isNaN(chosenIndex) ||
    chosenIndex < 0 ||
    chosenIndex >= top10Trends.length
  ) {
    throw new Error(`Invalid trend selection index: ${answer}`);
  }

  const selected = top10Trends[chosenIndex];
  genAIService['saveTrendToFile'](selected.title);
  console.log(`Selected Trend: ${selected.title}`);
  return {title: selected.title, index: chosenIndex};
}

export default getBestTitleFromTopTrends;
