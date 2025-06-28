import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import GenerativeAIService from './generativeAI';
import scrapeTrends24 from './scrapeTrends24';
// import fetchTweetTrends from './fetchTweetTrends';
// import fetch from "node-fetch";
import {Page} from 'puppeteer';
import {Trend} from '../types/Trend';

const postTweetTrends = async (label: string, page: Page) => {
  // const generativeAIService = new GenerativeAIService();
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  try {
    // Step 1: Define available methods and pick one randomly
    // const availableMethods = [
    //   generativeAIService.generateQuote.bind(generativeAIService),
    //   generativeAIService.generatePost.bind(generativeAIService),
    // ];
    // const randomMethod = availableMethods[Math.floor(Math.random() * availableMethods.length)];
    // const randomPost = await generativeAIService.gainTrain();

    // Step 2: Generate a post using the randomly selected method
    // const randomPost = await randomMethod();
    // console.log(`Generated Post: ${randomPost}`);

    // fetch trending topics and go to explore tab to fetch top posts
    let trends: Trend[] | void = [];
    console.log('Fetching trends...');
    trends = await scrapeTrends24();
    console.log('Fetched trends:', trends);
    // Here, we call the endpoint http://localhost:3000/fetch-trend-comments
    // log what it returns. impoert fetch from 'node-fetch';
    /* const response = await fetch("http://localhost:3000/fetch-trend-comments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trends }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const comments = await response.json();
    console.log("Fetched comments:", comments);
    */
    await sleep(75000);
    // const { randomPhrase, comments } = await fetchTweetTrends("Search and explore", page, trends);
    // const randomPost = await generativeAIService.generateTweetTrends(randomPhrase, comments);
    // console.log(`Generated Post: ${randomPost}`);

    // Step 3: Navigate to the specified label
    await page.evaluate(
      (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(link =>
          link.getAttribute('aria-label')?.includes(label),
        );
        if (targetLink instanceof HTMLElement) {
          targetLink.click();
        } else {
          throw new Error(`Link with label "${label}" not found`);
        }
      },
      label,
      navSelector,
    );

    console.log(`Clicked on the "${label}" link successfully.`);
    await sleep(2000);

    // Reload the page
    await page.reload({waitUntil: 'networkidle2'});
    console.log('Page reloaded successfully.');

    // Step 4: Click on the placeholder with "What’s happening?" inner text
    const isPlaceholderClicked = await page.evaluate(
      async (placeholderSelector: any) => {
        const placeholder = document.querySelector(placeholderSelector);
        if (
          placeholder &&
          placeholder.innerText.trim() === 'What’s happening?'
        ) {
          placeholder.click();
          return true;
        }
        return false;
      },
      placeholderSelector,
    );

    if (!isPlaceholderClicked) {
      throw new Error(
        'Failed to find or click the placeholder with "What’s happening?" text.',
      );
    }

    console.log('Clicked on the "What’s happening?" placeholder successfully.');
    await sleep(2000);

    // Step 5: Type the randomly selected post into the editor
    // await page.keyboard.type(randomPost, { delay: 200 });
    console.log('Typed the message into the editor successfully.');
    await sleep(2000);

    // Step 6: Click the "Post" button
    const isPostClicked = await page.evaluate(
      async (postButtonSelector: any) => {
        const postButton = Array.from(
          document.querySelectorAll(postButtonSelector),
        ).find(span => span.innerText === 'Post');
        if (postButton) {
          postButton.click();
          return true;
        }
        return false;
      },
      postButtonSelector,
    );

    if (!isPostClicked) {
      throw new Error('Failed to find or click the "Post" button.');
    }

    console.log('Clicked on the "Post" button successfully.');
    const waitTime = getRandomWaitTime(2000, 6000);
    await sleep(waitTime);
  } catch (err: any) {
    console.error(`Error in post function: ${err.message}`);
  }
};

export {postTweetTrends};
