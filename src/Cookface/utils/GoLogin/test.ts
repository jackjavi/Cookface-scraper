import {GologinApi} from 'gologin';
import sleep from '../sleep';
import * as dotenv from 'dotenv';
dotenv.config();

// Token can be passed here in code or from env
const token: string = process.env.GL_API_TOKEN!;
const gologin = GologinApi({
  token,
  // If you want to run particular profile you need to pass profileId param
});

async function main() {
  // This line of code creates new profile that will be run. If you want to run existed profile - delete this line of code
  // const profile = await gologin.createProfileRandomFingerprint();
  const profileId = '68cc89632f863619e48bff2b';

  // This line of code adds gologin proxy to the profile.
  // await gologin.addGologinProxyToProfile(profileId, 'US');

  // This line of code starts the browser and return object that can be managed by puppeteer
  const {browser} = await gologin.launch({profileId});

  // Opens new page in browser
  const page = await browser.newPage();

  // Goes to website and waits untill all parts of the website is loaded
  await page.goto('https://iphey.com/', {waitUntil: 'networkidle2'});

  // Reads profile check result in website
  const status = await page.$eval(
    '.trustworthy:not(.hide)',
    (elt: {innerText: string}) => elt?.innerText?.trim(),
  );

  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('status', status);
  await sleep(20000);

  // Opens new page in browser
  const page2 = await browser.newPage();

  // Goes to website and waits untill all parts of the website is loaded
  await page2.goto('https://youtu.be/XbmB6vvCaOQ?si=vAC5dsBQnmsS3_qU', {
    waitUntil: 'networkidle2',
    timeout: 180000,
  });
  await sleep(100000);

  // This line of code deletes used profile. If you dont want to delete used profie - remove this line
  // await gologin.deleteProfile(profileId);

  return status;
}

main().catch(console.error).finally(gologin.exit);
