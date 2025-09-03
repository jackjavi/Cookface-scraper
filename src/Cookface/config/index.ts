import * as dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'GENERATIVE_AI_API_KEY',
  'BROWSERWSENDPOINT_URL',
  'X_USERNAME',
  'X_PASSWORD',
  'GENERATIVE_AI_API_KEY_EBC_SPORTS',
  'ARTICLES_STORE',
  'FULL_ARTICLES_STORE',
  'PARAPHRASED_CONTENT_FOR_TELEGRAM_STORE',
  'TELEGRAM_HTTP_TOKEN',
  'TELEGRAM_EBC_SPORTS_GROUP_CHAT_ID',
  'EBC_SPORTS_CHANNEL_LINK',
  'TNK_DEFAULT_IMG',
  'SAVED_TWEEPS',
  'IMAGES_STORE',
  'GENERATIVE_AI_API_KEY_TTS',
  'AUDIO_STORE',
  'GENERATIVE_AI_API_KEY_AUDIO_TRANSCRIPTS',
  'VIDEO_STORE',
];

requiredEnvVars.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

interface Config {
  generativeAIKey: string;
  browserWSEndpointUrl: string;
  xUsername: string;
  xPassword: string;
  generativeAIKeyEBCSports: string;
  generativeAIKeyTTS: string;
  articlesStore: string;
  fullArticlesStore: string;
  paraphrasedForTelegramStore: string;
  telegramToken: string;
  telegramEBCSportsChatID: string;
  telegramPhotosStore: string;
  ebcSportsChannelLink: string;
  tnkDefaultIMG: string;
  savedTweeps: string;
  imagesStore: string;
  audioStore: string;
  audioTranscriptsKey: string;
  videoStore: string;
}

const config: Config = {
  generativeAIKey: process.env.GENERATIVE_AI_API_KEY as string,
  browserWSEndpointUrl: process.env.BROWSERWSENDPOINT_URL as string,
  xUsername: process.env.X_USERNAME as string,
  xPassword: process.env.X_PASSWORD as string,
  generativeAIKeyEBCSports: process.env
    .GENERATIVE_AI_API_KEY_EBC_SPORTS as string,
  generativeAIKeyTTS: process.env.GENERATIVE_AI_API_KEY_TTS as string,
  audioTranscriptsKey: process.env
    .GENERATIVE_AI_API_KEY_AUDIO_TRANSCRIPTS as string,
  articlesStore: process.env.ARTICLES_STORE as string,
  fullArticlesStore: process.env.FULL_ARTICLES_STORE as string,
  paraphrasedForTelegramStore: process.env
    .PARAPHRASED_CONTENT_FOR_TELEGRAM_STORE as string,
  telegramToken: process.env.TELEGRAM_HTTP_TOKEN as string,
  telegramEBCSportsChatID: process.env
    .TELEGRAM_EBC_SPORTS_GROUP_CHAT_ID as string,
  telegramPhotosStore: process.env.TELEGRAM_PHOTOS_STORE as string,
  ebcSportsChannelLink: process.env.EBC_SPORTS_CHANNEL_LINK as string,
  tnkDefaultIMG: process.env.TNK_DEFAULT_IMG as string,
  savedTweeps: process.env.SAVED_TWEEPS as string,
  imagesStore: process.env.IMAGES_STORE as string,
  audioStore: process.env.AUDIO_STORE as string,
  videoStore: process.env.VIDEO_STORE as string,
};

export default config;
