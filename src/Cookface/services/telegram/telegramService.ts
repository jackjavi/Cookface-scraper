import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import config from '../../config/index.js';

class TelegramService {
  private botToken: string;
  private chatId: string;
  private baseURL: string;
  constructor() {
    this.botToken = config.telegramToken;
    this.chatId = config.telegramEBCSportsChatID;
    this.baseURL = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendPhotoWithCaption(imagePath: string, caption: string) {
    try {
      const form = new FormData();
      const readStream = fs.createReadStream(imagePath);

      form.append('chat_id', this.chatId);
      form.append('photo', readStream);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML'); // Allows basic formatting

      const response = await axios.post(`${this.baseURL}/sendPhoto`, form, {
        headers: {...form.getHeaders()},
        timeout: 60000, // 60 second timeout
      });

      return response.data;
    } catch (error) {
      console.error('Error sending photo to Telegram:', error);
      throw error;
    }
  }

  async sendMessage(text: string) {
    try {
      const response = await axios.post(`${this.baseURL}/sendMessage`, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML',
      });

      return response.data;
    } catch (error) {
      console.error('Error sending message to Telegram:', error);
      throw error;
    }
  }

  async getChatInfo() {
    try {
      const response = await axios.get(
        `${this.baseURL}/getChat?chat_id=${this.chatId}`,
      );
      return response.data;
    } catch (error) {
      console.error('Error getting chat info:', error);
      throw error;
    }
  }
}

export default TelegramService;
