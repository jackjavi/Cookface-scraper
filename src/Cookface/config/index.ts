import * as dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'GENERATIVE_AI_API_KEY',
  'BROWSERWSENDPOINT_URL',
  'X_USERNAME',
  'X_PASSWORD',
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
}

const config: Config = {
  generativeAIKey: process.env.GENERATIVE_AI_API_KEY as string,
  browserWSEndpointUrl: process.env.BROWSERWSENDPOINT_URL as string,
  xUsername: process.env.X_USERNAME as string,
  xPassword: process.env.X_PASSWORD as string,
};

export default config;
