import {GoogleGenerativeAI, GenerativeModel} from '@google/generative-ai';
import config from '../config/index';
import {Comment} from '../types/Comment';
import * as fs from 'fs';
import {Post} from '../types/Post';

interface TweetImage {
  src: string;
  alt: string | null;
  articleIndex: number;
}

class GenerativeAIService {
  private xUsername: string;
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  private trendsFilePath = 'storage/usedTrends.json';
  private engagementIdeasPath = 'storage/usedIdeas.json';
  private jokesFilePath = 'storage/usedJokes.json';
  private shengPostsFilePath = 'storage/usedShengPosts.json';
  private shortPostsFilePath = 'storage/usedShortPosts.json';

  constructor() {
    this.xUsername = config.xUsername;
    this.apiKey = config.generativeAIKeyEBCSports;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
    this.visionModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });
  }

  private saveToJson(filePath: string, entry: string) {
    let data: string[] = [];
    try {
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      data.unshift(entry);
      if (data.length > 20) data = data.slice(0, 20);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to write to ${filePath}:`, error);
    }
  }

  private getRecentEntries(filePath: string, count: number): string[] {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Array.isArray(data) ? data.slice(0, count) : [];
      }
    } catch (error) {
      console.error(`Failed to read ${filePath}:`, error);
    }
    return [];
  }

  public saveTrendToFile(trend: string): void {
    this.saveToJson(this.trendsFilePath, trend);
  }

  public saveIdeaToFile(idea: string): void {
    this.saveToJson(this.engagementIdeasPath, idea);
  }

  async generateEngagementPost(): Promise<string> {
    const recentIdeas = this.getRecentEntries(this.engagementIdeasPath, 8);

    const prompt = `
You are a social media creator writing short, highly engaging Facebook posts to spark interaction, curiosity, or reflection.
Avoid repeating these recent ideas: ${recentIdeas.join(', ')}

Your goal:
- Make readers pause, think, and possibly comment.
- Use a creative mix of history facts, curiosity, psychological prompts, or quirky trivia.
- Search the web or trending data for fresh and relevant post ideas.
- Keep it under 80 characters and DO NOT add hashtags.

Examples:
- "Did you know ancient Egyptians used honey as a wound treatment?"
- "Why do we dream? Neuroscientists are still debating."
- "What if Mondays were optional?"
- "Napoleon was once attacked by a horde of bunnies."

Write 1 such post idea now. Keep it original and don’t repeat the above.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const idea = response
        .text()
        .replace(/^\*\*.*?:\s*/, '')
        .trim();

      this.saveIdeaToFile(idea);
      return idea;
    } catch (error) {
      console.error('Error generating engagement post:', error);
      throw new Error('Failed to generate engagement post');
    }
  }

  async chooseBestTitleOnly(
    top10Titles: string[],
    recentTrends: string[],
  ): Promise<string | null> {
    const prompt = `
You're an assistant for a social media page called "TRENDING NEWS KE", which covers viral stories and popular trends in Kenya and globally.

You will receive:
- A list of the top 15 trending topics by title (no context, no tweets)
- A list of the 8 most recently used trends that should be avoided
- Do not reselect related topics, e.g. the trend "#FreeBonifaceMwangi" directly relates to the trend "Boniface Mwangi"

Your job is to select the **single best** trend title to use next for generating a Facebook News Bite. Avoid titles that:
- Are hashtags for promotions/brands/events
- Are religious or political slogans
- Were used in the last 8 posts

Prefer titles that are:
- Sports, entertainment, or lifestyle related
- Unique, catchy, and engaging
- Timely and relevant to national or global events
- Likely to spark engagement or emotion
- Naturally viral or eye-catching

Here are the top 10 titles:
${top10Titles.map((t, i) => `${i}. ${t}`).join('\n')}

Do NOT pick any of these 8 recent ones:
${recentTrends.join(', ')}

Reply ONLY with the exact title from the list that should be used (no number, no explanation, just the text).`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const chosenTitle = response.text().trim();

      if (!top10Titles.includes(chosenTitle)) {
        console.warn('AI returned a title not found in the top 10 list.');
        return null;
      }

      return chosenTitle;
    } catch (error) {
      console.error('Error choosing best title only:', error);
      return null;
    }
  }

  async chooseBestTrend(
    candidateTrend: string,
    comments: Comment[],
    recentTrends: string[],
  ): Promise<'1' | '2' | '3' | '5'> {
    const examplePosts = comments
      .slice(0, 15)
      .map(
        (post, index) =>
          `Post ${index + 1}:
User: ${post.user}
Content: "${post.content}"
Timestamp: ${post.timestamp}
`,
      )
      .join('\n');

    const prompt = `
You're a trend analyzer for social media. Your task is to help decide if a trending topic should be used to generate a Facebook News Bite.

Input: A trending topic "${candidateTrend}" with 15 sample posts.

Rules:
- I want easy-to-read content that uses simple human language and does not sound robotic and AI-generated.
- Ensure to include all relevant context from the posts so that anyone can understand the news bite without needing to see the original posts.
- Do NOT select if the trend is a promotional hashtag or clearly linked to a specific group (e.g., religious orgs, brands).
- Do NOT select if the topic was used recently. Here are the last 5 used: ${recentTrends.join(', ')}

Score the trend with:
1 — Strongly Recommended
2 — Good Option
3 — Mediocre Option
5 — Do NOT Use

---
Example Posts:
${examplePosts}
---
Now, respond ONLY with one of the numbers: 1, 2, 3, or 5.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const answer = response.text().trim();

      if (!['1', '2', '3', '5'].includes(answer)) {
        throw new Error('Invalid score returned from GenAI');
      }

      if (answer === '1' || answer === '2') {
        this.saveTrendToFile(candidateTrend);
      }

      return answer as '1' | '2' | '3' | '5';
    } catch (error) {
      console.error('Error choosing best trend:', error);
      return '5';
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
      .slice(0, 15)
      .map(
        (post, index) =>
          `Post ${index + 1}:\nUser: ${post.user}\nContent: "${post.content}"\nTimestamp: ${post.timestamp}\n\n`,
      )
      .join('');

    const prompt = `
      You are a digital writer creating compelling, original, and stylized "NEWS Bites" for Facebook under the theme - TRENDING NEWS KE.

Context:
You run a unique solo page — not affiliated with any official news channel — 
that reports trending developments in Kenya based on the hottest trends on social media. 
Important Point: The example posts from X do not necessarily address the trending
topic since users on X are used to combining hashtags to reach a larger audience; So,
ensure to generate content based on the example posts only addressing the trending topic!
These are not reposts or summaries of the tweets but instead re-imagined, professional-yet-personal 
news-style blurbs written in your own engaging voice. Your style feels:
- Conversational, yet polished
- Curiously edgy, yet grounded
- Scrollable and addictive — people visit your timeline just to keep up
- Reflective, sometimes humorous or urgent, depending on the tone of the trend

You are not just reporting — you're interpreting the vibe, revealing subtext, and writing like someone who reads between the lines.

---

**Task:**
Generate a compelling Facebook news-style post based on the following real trending topic 
and sample user posts collected from social media in Kenya. Keep the tone uniquely mine: 
a professional but human tone that raises curiosity and delivers scroll-worthy updates. 
Format it like a one-paragraph news summary, with slight storytelling flair, and a catchy closer if possible.
Character limit should not exceed 220 characters or 35 words.

Title: TRENDING NEWS KE  
Trending Topic: ${trendingTopic}  
Top Posts: ${examplePosts}

---

**Rules:**
- Character limit: 220 characters
- word count: 35 words
- Do NOT copy tweets verbatim
- Do NOT address the audience directly ("you")
- Do NOT include hashtags
- Avoid sounding like a reporter reading the news on-air
- Reimagine and rewrite from the collective vibe, not from any one tweet
- Assume the reader wants to be updated quickly but with color and tone

    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const generatedPost = response.text();

      const cleanPost = generatedPost
        .replace(/\*\*/g, '')
        .replace(/\n/g, ' ')
        .replace(/(^["'“”‘’]+)|(["'“”‘’]+$)/g, '')
        .replace(/(?<=\s)["'“”‘’]+|["'“”‘’]+(?=\s)/g, '')
        .trim();

      return cleanPost;
    } catch (error) {
      console.error('Error generating tweet trends post:', error);
      throw new Error('Failed to generate a post for the trending topic');
    }
  }

  async selectMostRelevantImage(
    newsBite: string,
    comments: Comment[],
    images: TweetImage[],
  ): Promise<TweetImage | null> {
    const RELEVANCE_THRESHOLD = 6; // Minimum score of 6 out of 10 to be considered relevant

    if (!images || images.length === 0) {
      console.log('No images available for analysis, returning default image');
      return {
        src: config.tnkDefaultIMG,
        alt: 'Default TNK image',
        articleIndex: -1,
      };
    }

    if (images.length === 1) {
      console.log('Only one image available, analyzing it first...');
      // Still analyze the single image to check if it meets threshold
    }

    try {
      // Function to convert image URL to base64 for Gemini API
      const imageToGenerativePart = async (imageUrl: string) => {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          const base64String = Buffer.from(buffer).toString('base64');

          // Determine MIME type from URL or default to JPEG
          let mimeType = 'image/jpeg';
          if (imageUrl.includes('.png')) mimeType = 'image/png';
          else if (imageUrl.includes('.gif')) mimeType = 'image/gif';
          else if (imageUrl.includes('.webp')) mimeType = 'image/webp';

          return {
            inlineData: {
              data: base64String,
              mimeType: mimeType,
            },
          };
        } catch (error) {
          console.error('Error processing image:', imageUrl, error);
          return null;
        }
      };

      // Analyze each image and get relevance scores
      const imageAnalyses: Array<{
        image: TweetImage;
        score: number;
        reason: string;
      }> = [];

      for (let i = 0; i < Math.min(images.length, 5); i++) {
        // Limit to 5 images to avoid API limits
        const image = images[i];
        console.log(
          `Analyzing image ${i + 1}/${Math.min(images.length, 5)}: ${image.src}`,
        );

        const imagePart = await imageToGenerativePart(image.src);
        if (!imagePart) {
          console.log(`Skipping image ${i + 1} due to processing error`);
          continue;
        }

        // Context from comments related to this image's article
        const relatedComments = comments
          .slice(0, 5)
          .map((comment, index) => `Comment ${index + 1}: "${comment.content}"`)
          .join('\n');

        const prompt = `
You are analyzing an image to determine its relevance to a news story.

NEWS BITE: "${newsBite}"

CONTEXT FROM COMMENTS:
${relatedComments}

IMAGE TO ANALYZE: [Image provided]

Your task:
1. Describe what you see in the image
2. Assess how relevant this image is to the news bite content
3. Rate the relevance on a scale of 1-10 (10 = highly relevant, 1 = not relevant)
4. Provide a brief reason for your rating

Consider:
- Visual elements that directly relate to the news story
- People, objects, or scenes mentioned in the news bite
- Emotional tone and context alignment
- Overall visual storytelling value

Respond in this exact format:
DESCRIPTION: [What you see in the image]
RELEVANCE_SCORE: [Number from 1-10]
REASON: [Brief explanation of why this score]
      `;

        try {
          const result = await this.visionModel.generateContent([
            prompt,
            imagePart,
          ]);
          const response = result.response.text();

          // Parse the response to extract score and reason
          const scoreMatch = response.match(/RELEVANCE_SCORE:\s*(\d+)/);
          const reasonMatch = response.match(/REASON:\s*(.+)/);
          const descriptionMatch = response.match(
            /DESCRIPTION:\s*(.+?)(?=RELEVANCE_SCORE:)/s,
          );

          const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
          const reason = reasonMatch
            ? reasonMatch[1].trim()
            : 'No reason provided';
          const description = descriptionMatch
            ? descriptionMatch[1].trim()
            : 'No description provided';

          console.log(
            `Image ${i + 1} analysis - Score: ${score}, Description: ${description}`,
          );

          imageAnalyses.push({
            image: image,
            score: score,
            reason: `${description} | ${reason}`,
          });

          // Add delay between API calls to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error analyzing image ${i + 1}:`, error);
          // Add with low score if analysis fails
          imageAnalyses.push({
            image: image,
            score: 1,
            reason: 'Analysis failed',
          });
        }
      }

      // Select the image with the highest relevance score
      if (imageAnalyses.length === 0) {
        console.log('No images could be analyzed, returning default image');
        return {
          src: config.tnkDefaultIMG,
          alt: 'Default TNK image',
          articleIndex: -1,
        };
      }

      const bestImage = imageAnalyses.reduce((best, current) =>
        current.score > best.score ? current : best,
      );

      // Check if the best image meets the relevance threshold
      if (bestImage.score < RELEVANCE_THRESHOLD) {
        console.log(
          `Best image score (${bestImage.score}) is below threshold (${RELEVANCE_THRESHOLD}). Using default image.`,
        );
        console.log(`Rejected image reason: ${bestImage.reason}`);
        return {
          src: config.tnkDefaultIMG,
          alt: 'Default TNK image',
          articleIndex: -1,
        };
      }

      console.log(
        `Selected image with score ${bestImage.score}: ${bestImage.reason}`,
      );
      console.log(`Selected image URL: ${bestImage.image.src}`);

      return bestImage.image;
    } catch (error) {
      console.error('Error in image selection process:', error);
      // Fallback to default image if analysis fails
      console.log('Falling back to default image due to error');
      return {
        src: config.tnkDefaultIMG,
        alt: 'Default TNK image',
        articleIndex: -1,
      };
    }
  }

  async generateReply(posts: Post[]): Promise<string> {
    if (!Array.isArray(posts) || posts.length === 0) {
      throw new Error('Posts should be a non-empty array of objects.');
    }

    const mainPost = posts[0];
    const comments = posts.slice(1);

    const prompt = `
My username is: ${this.xUsername}

You're an internet-native, witty persona who understands online culture. Your goal is to craft a short, sharp, and punchy reply (under 15 characters) to a trending post on X (formerly Twitter), based on the original post and the energy in the comments.

### 🔷 Main Post
- 👤 User: ${mainPost.user}
- 📝 Content: "${mainPost.content}"
- ⏰ Time: ${mainPost.timestamp}

### 💬 Top Comments
${comments
  .map(
    (comment, index) =>
      `${index + 1}. 👤 ${comment.user}  
    📝 "${comment.content}"  
    ⏰ ${comment.timestamp}`,
  )
  .join('\n')}

### 🧠 Your Job:
Craft a **very short** (≤15 characters) reply that:
- **Feels native** to this thread's vibe and tone.
- **Engages or teases**—encourage interaction, spark curiosity, or add an on-point jab.
- Avoids hashtags and boring stuff.
- If the post asks for usernames, respond with one that keeps underscores (_), e.g. @life_meth_money
- Your tone: Smart, spicy, culturally aware. Slightly unhinged is okay—but not irrelevant.
- Style: Tweet-like. Fits into the chaotic genius of the X timeline.

Only output the final reply. No explanations. No markdown. No hashtags.

Let’s go viral.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const reply = response.text();
      // Clean the post: remove everything up to and including the first colon and any "**" markdown
      const cleanReply = reply
        .replace(/^[^:]*:\s*/, '') // Remove everything up to and including the first colon
        .replace(/\*\*/g, '') // Remove any Markdown-style bold indicators (**)
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/(^["'“”‘’]+)|(["'“”‘’]+$)/g, '') // Remove quotes at start/end
        .replace(/(?<=\s)["'“”‘’]+|["'“”‘’]+(?=\s)/g, '') // Remove stray quotes around words
        .trim();

      console.log('Cleaned reply:', cleanReply);
      return cleanReply;
    } catch (error) {
      console.error('Error generating reply:', error);
      throw new Error('Failed to generate reply');
    }
  }

  async generateKenyanJokePost(): Promise<string> {
    const recentJokes = this.getRecentEntries(this.jokesFilePath, 10);

    const prompt = `
      **Task**: Write a short joke in a mix of Kiswahili and Sheng. 
      Avoid repeating these: ${recentJokes.join(', ')}

      The joke should feel like a funny Facebook post from a young Kenyan.
      Use cultural references and witty phrasing. Max 100 characters. No emojis or hashtags.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const rawJoke = response.text();
      const cleanJoke = rawJoke.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      this.saveToJson(this.jokesFilePath, cleanJoke);
      return cleanJoke;
    } catch (error) {
      console.error('Error generating Kenyan joke:', error);
      throw new Error('Failed to generate Kenyan joke');
    }
  }

  async generateFacebookPostSwahiliSheng(): Promise<string> {
    const recentPosts = this.getRecentEntries(this.shengPostsFilePath, 10);

    const prompt = `
      **Task**: Andika post fupi ya Kiswahili/Sheng. Epuka kurudia hizi: ${recentPosts.join(', ')}
      Style: Funny, reflective, or ironic. Max 100 characters. No emojis or hashtags.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const rawPost = response.text();
      const cleanPost = rawPost.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      this.saveToJson(this.shengPostsFilePath, cleanPost);
      return cleanPost;
    } catch (error) {
      console.error('Error generating Kiswahili/Sheng post:', error);
      throw new Error('Failed to generate local Facebook post');
    }
  }

  async generateShortFacebookPost(): Promise<string> {
    const recentPosts = this.getRecentEntries(this.shortPostsFilePath, 10);

    const prompt = `
      **Task**: Write a short-form Facebook post. Avoid these: ${recentPosts.join(', ')}
      Style: punchy, human, thought-provoking. < 80 characters. No hashtags.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const generatedPost = response.text();
      const cleanPost = generatedPost
        .replace(/\*\*/g, '')
        .replace(/\n/g, ' ')
        .trim();
      this.saveToJson(this.shortPostsFilePath, cleanPost);
      return cleanPost;
    } catch (error) {
      console.error('Error generating post:', error);
      throw new Error('Failed to generate post');
    }
  }
}

export default GenerativeAIService;
