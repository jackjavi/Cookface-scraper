import {GoogleGenerativeAI, GenerativeModel} from '@google/generative-ai';
import config from '../config/index.js';
import {Article} from '../types/Article.js';

class GenerativeAIService {
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.apiKey = config.generativeAIKeyEBCSports;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
  }

  async generateTelegramContent(title: string, articles: Article[]) {
    const prompt = `Transform the following football content into an engaging Telegram channel post:

TITLE: ${title}
CONTENT: ${JSON.stringify(articles)}

REQUIREMENTS:
- Maximum 150 words or 750 characters
- Independent sports channel tone with suspense and intrigue
- SEO-optimized for football keywords
- Playful yet professional football journalism style
- Use emojis strategically (⚽🔥💥⭐🏆)
- Include breaking news elements and excitement
- Avoid AI clichés: "dive deep", "tapestry", "multifaceted", "interplay"
- Short, punchy sentences
- Create FOMO (Fear of Missing Out)
- End with engaging hooks or questions

TONE EXAMPLES:
- "BREAKING: Transfer saga takes unexpected turn..."
- "Plot twist in the Championship race! 🔥"
- "You won't believe what happened next..."
- "This changes everything for [Team]..."

FORMAT: Return ONLY the paraphrased telegram content, no JSON, no extra text.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log('Generated Telegram content:', text);
      return text.trim();
    } catch (error: any) {
      console.error('Error generating telegram content:', error);
      throw new Error('Failed to generate telegram content');
    }
  }

  async generateTelegramTitle(
    initialTitle: string,
    paraphrasedContent: string,
  ) {
    const prompt = `Create a captivating Telegram channel title based on:

ORIGINAL TITLE: ${initialTitle}
NEW CONTENT: ${paraphrasedContent}

REQUIREMENTS:
- Maximum 60 characters for mobile readability
- Eye-catching and click-worthy
- Maintain connection to original title
- 100% plagiarism-free and unique
- Include power words: BREAKING, EXCLUSIVE, SHOCK, TWIST, REVEALED
- Use emojis strategically (max 2): ⚽🔥💥⭐🚨
- SEO-friendly football keywords
- Create curiosity and urgency
- Avoid clickbait that misleads

EXAMPLES:
- "🚨 BREAKING: City's £50M Shock Move!"
- "⚽ EXCLUSIVE: United's Secret Deal Exposed"
- "🔥 TWIST: Chelsea's Transfer Bombshell"

FORMAT: Return ONLY the new title, no quotes, no JSON, no extra text.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log('Generated Telegram title:', text);
      return text.trim();
    } catch (error: any) {
      console.error('Error generating telegram title:', error);
      throw new Error('Failed to generate telegram title');
    }
  }
}

export default GenerativeAIService;
