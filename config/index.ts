import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['GENERATIVE_AI_API_KEY', 'BROWSERWSENDPOINT_URL'];

requiredEnvVars.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

interface Config {
  generativeAIKey: string;
  browserWSEndpointUrl: string;
}

const config: Config = {
  generativeAIKey: process.env.GENERATIVE_AI_API_KEY as string,
  browserWSEndpointUrl: process.env.BROWSERWSENDPOINT_URL as string,
};

export default config;
