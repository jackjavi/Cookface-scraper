import {GoogleGenerativeAI, GenerativeModel} from '@google/generative-ai';
import config from '../config/index';
import {Comment} from '../types/Comment';
import * as fs from 'fs';

class GenerativeAIService {
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private trendsFilePath: string = './usedTrends.json';

  constructor() {
    this.apiKey = config.generativeAIKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
  }


  private saveTrendToFile(trend: string): void {
    let usedTrends: string[] = [];
    try {
      if (fs.existsSync(this.trendsFilePath)) {
        usedTrends = JSON.parse(fs.readFileSync(this.trendsFilePath, 'utf-8'));
      }
      usedTrends.unshift(trend);
      fs.writeFileSync(this.trendsFilePath, JSON.stringify(usedTrends, null, 2));
    } catch (error) {
      console.error('Failed to save trend to file:', error);
    }
  }

  async chooseBestTrend(
    candidateTrend: string,
    comments: Comment[],
    recentTrends: string[]
  ): Promise<'1' | '2' | '3' | '5'> {
    const examplePosts = comments
      .slice(0, 15)
      .map(
        (post, index) =>
          `Post ${index + 1}:
User: ${post.user}
Content: "${post.content}"
Timestamp: ${post.timestamp}
`
      )
      .join('\n');

    const prompt = `
You're a trend analyzer for social media. Your task is to help decide if a trending topic should be used to generate a Facebook News Bite.

Input: A trending topic "${candidateTrend}" with 15 sample posts.

Rules:
- Do NOT select if the trend is a promotional hashtag or clearly linked to a specific group (e.g., religious orgs, brands).
- Do NOT select if the topic was used recently. Here are the last 5 used: ${recentTrends.join(', ')}
- DO select if the trend has mass engagement or touches on current national/world events, emotions, politics, humor, or controversy.

Score the trend with:
1 — Strongly Recommended
2 — Good Option
3 — Mediocre Option
5 — Do NOT Use

---
Example Posts:
${examplePosts}
---
Now, respond ONLY with one of the numbers: 1, 2, 3, or 5, based on the quality of the topic."`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text().trim();

      if (!['1', '2', '3', '5'].includes(answer)) {
        throw new Error('Invalid score returned from GenAI');
      }

      // If score is acceptable, save the trend
      if (answer === '1' || answer === '2') {
        this.saveTrendToFile(candidateTrend);
      }

      return answer as '1' | '2' | '3' | '5';
    } catch (error) {
      console.error('Error choosing best trend:', error);
      return '5'; // Default to reject if error occurs
    }
  }


  async generateNewsBiteFromTrends(
    trendingTopic: string | null,
    posts: Comment[],
  ): Promise<string> {
    if (
      typeof trendingTopic !== 'string' ||
      !Array.isArray(posts) ||
      posts.length === 0
    ) {
      throw new Error(
        'Invalid input: trendingTopic must be a string and posts must be a non-empty array.',
      );
    }

    const examplePosts = posts
      .slice(0, 15) // Limit to 15 posts
      .map(
        (post, index) =>
          `Post ${index + 1}:\nUser: ${post.user}\nContent: "${post.content}"\nTimestamp: ${post.timestamp}\n\n`,
      )
      .join('');

    const prompt = `
      You are a digital writer creating compelling, original, and stylized "NEWS Bites" for Facebook under the theme - TRENDING NEWS KE.

Context:
You run a unique solo page — not affiliated with any official news channel — 
that reports trending developments in Kenya based on the hottest X (formerly Twitter) trends. 
These are not reposts or summaries of the tweets but instead re-imagined, professional-yet-personal 
news-style blurbs written in your own engaging voice. Your style feels:
- Conversational, yet polished
- Curiously edgy, yet grounded
- Scrollable and addictive — people visit your timeline just to keep up
- Reflective, sometimes humorous or urgent, depending on the tone of the trend

You are not just reporting — you're interpreting the vibe, revealing subtext, and writing like someone who reads between the lines.

---

**Task:**
Generate a compelling Facebook news-style post (not a tweet) based on the following real trending topic 
and sample user posts collected from X in Kenya. Keep the tone uniquely mine: 
a professional but human tone that raises curiosity and delivers scroll-worthy updates. 
Format it like a one-paragraph news summary, with slight storytelling flair, and a catchy closer if possible.
Character limit should not exceed 240 characters or 40 words.

Title: TRENDING NEWS KE  
Trending Topic: ${trendingTopic}  
Top Posts: ${examplePosts}

---

**Rules:**
- Character limit: 240 characters
- word count: 40 words
- Do NOT copy tweets verbatim
- Do NOT address the audience directly ("you")
- Do NOT include hashtags
- Avoid sounding like a reporter reading the news on-air
- Reimagine and rewrite from the collective vibe, not from any one tweet
- Assume the reader wants to be updated quickly but with color and tone

    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedPost = response.text();

      // Clean the post for output
      const cleanPost = generatedPost
        .replace(/^[^:]*:\s*/, '') // Remove everything up to and including the first colon
        .replace(/\*\*/g, '') // Remove any Markdown-style bold indicators (**)
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/^\"|\"$/g, '') // Remove leading and trailing quotes
        .trim();

      return cleanPost;
    } catch (error) {
      console.error('Error generating tweet trends post:', error);
      throw new Error('Failed to generate a post for the trending topic');
    }
  }
}

export default GenerativeAIService;
