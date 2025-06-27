import sleep from "../utils/sleep";
import getRandomWaitTime from "../utils/randomWaitTime";
import GenerativeAIService from "./generativeAI";
import { Page } from "puppeteer";
import { exit } from "process";

const postTrendNewsOnX = async (label: string, page: Page, newsBite: string) => {
  const generativeAI = new GenerativeAIService();
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  try {
    // Step 1: Navigate to the specified label
    await page.evaluate(
      async (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find((link) =>
          link.getAttribute("aria-label")?.includes(label)
        );
        if (targetLink instanceof HTMLElement) {
          (targetLink as HTMLElement).click();
        }
        else throw new Error(`Link with label "${label}" not found`);
      },
      label,
      navSelector
    );
    console.log(`Clicked on the "${label}" link successfully.`);
    await sleep(2000);

    // Reload the page
    await page.reload({ waitUntil: "networkidle2" });
    console.log("Page reloaded successfully.");

    // Step 4: Click on the placeholder with "What’s happening?" inner text
   const isPlaceholderClicked = await page.evaluate(
  (placeholderSelector) => {
    const placeholder = document.querySelector(placeholderSelector) as HTMLElement | null;
    if (placeholder && placeholder.innerText.trim() === "What’s happening?") {
      placeholder.click();
      return true;
    }
    return false;
  },
  placeholderSelector
);

    if (!isPlaceholderClicked) {
      throw new Error(
        'Failed to find or click the placeholder with "What’s happening?" text.'
      );
    }

    console.log(
      'Clicked on the "What’s happening?" placeholder successfully.'
    );
    await sleep(2000);

    // Step 5: Type the randomly selected post into the editor
    await page.keyboard.type(newsBite, { delay: 200 });
    console.log("Typed the message into the editor successfully.");
    await sleep(2000);
    // await sleep(75000);

    // Step 6: Click the "Post" button
    const isPostClicked = await page.evaluate((postButtonSelector) => {
  const postButton = Array.from(
    document.querySelectorAll(postButtonSelector)
  ).find((span) => {
    const el = span as HTMLElement;
    return el.innerText === "Post";
  });

  if (postButton) {
    (postButton as HTMLElement).click();
    return true;
  }
  return false;
}, postButtonSelector);


    if (!isPostClicked) {
      throw new Error('Failed to find or click the "Post" button.');
    }

    console.log('Clicked on the "Post" button successfully.');
    const waitTime = getRandomWaitTime(2000, 6000);
    await sleep(waitTime);
    exit(0); // Exit the process after posting

  } catch (err: any) {
    console.error(`Error in post function: ${err.message}`);
    exit(1); // Exit with an error code if something goes wrong 
  }
};

export { postTrendNewsOnX };
