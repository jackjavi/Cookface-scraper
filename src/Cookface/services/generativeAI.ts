import {GoogleGenerativeAI, GenerativeModel} from '@google/generative-ai';
import config from '../../../config';
import {Post} from '../types/Post';

class GenerativeAIService {
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.apiKey = config.generativeAIKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
  }

  async generateTweetTrends(
    trendingTopic: String,
    posts: Post[],
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
      **Task**: Analyze the following trending topic and user posts from X/Twitter.
  
      ## Trending Topic:
      "${trendingTopic}"
  
      ## Example Posts:
      ${examplePosts}
  
      **Your Objective**: Craft a post that seamlessly integrates the trending topic into its content. The new post should:
      - Resonate with the tone, mood, and style of the provided posts.
      - Be concise, relevant, and engaging.
      - Include the trending topic naturally, whether as a hashtag or phrase.
      - Be suitable for platform X, encouraging engagement and relatability.
      - Avoid directly copying any specific content but feel authentic to the conversation.
      - Be between 20 and 120 characters.
  
      **Examples to Mimic**: Mimic the energy, language, and tone of the posts provided above. Ensure the generated post feels like it belongs in the same discussion.
  
      Output the post as plain text without any additional explanations or formatting.
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
