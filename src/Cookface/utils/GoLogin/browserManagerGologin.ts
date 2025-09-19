import {GologinApi} from 'gologin';
import sleep from '../sleep';
import * as dotenv from 'dotenv';
dotenv.config();

export async function initializeGologinBrowser() {
  try {
    // Token can be passed here in code or from env
    const token: string = process.env.GL_API_TOKEN!;
    const gologin = GologinApi({
      token,
      // If you want to run particular profile you need to pass profileId param
    });

    const profileId = '68cc89632f863619e48bff2b';

    // This line of code starts the browser and return object that can be managed by puppeteer
    const {browser} = await gologin.launch({profileId});

    return browser;
  } catch (error: any) {
    console.log('Error initializing Browser', error.message);
  }
}
