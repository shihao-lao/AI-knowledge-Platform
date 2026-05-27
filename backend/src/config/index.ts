import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL!,
  coze: {
    apiKey: process.env.COZE_API_KEY || '',
    baseUrl: process.env.COZE_BASE_URL || 'https://api.coze.com',
    defaultBotId: process.env.COZE_BOT_ID || '',
  },
  defaultUserId: process.env.DEFAULT_USER_ID || 'default_user',
};
