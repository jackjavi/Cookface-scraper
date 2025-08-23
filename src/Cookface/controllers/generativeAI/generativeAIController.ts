import fsPromises from 'fs/promises';
import config from '../../config/index.js';
import sleep from '../../utils/sleep.js';
import GenerativeAIService from '../../services/generativeAIEBCSports.js';

const generativeAIService = new GenerativeAIService();

const generateTelegramContent = async () => {
  try {
    // Read the full articles JSON file
    const rawData = await fsPromises.readFile(config.fullArticlesStore, 'utf8');
    const fullArticlesData = JSON.parse(rawData);

    const processedArticles = [];

    // Process each main article group
    for (const articleGroup of fullArticlesData.articles) {
      try {
        console.log(`Processing article group: ${articleGroup.title}`);

        // Generate paraphrased content for telegram using the whole group
        const telegramContent =
          await generativeAIService.generateTelegramContent(
            articleGroup.title,
            articleGroup.articles, // Pass the entire articles array
          );

        // Sleep to avoid rate limiting
        await sleep(20000);

        console.log(`Generating telegram title for: ${articleGroup.title}`);

        // Generate telegram title
        const telegramTitle = await generativeAIService.generateTelegramTitle(
          articleGroup.title,
          telegramContent,
        );

        // Sleep to avoid rate limiting
        await sleep(15000);

        // Add to processed articles
        processedArticles.push({
          initialTitle: articleGroup.title,
          telegramTitle: telegramTitle,
          telegramContent: telegramContent,
          imageUrl: articleGroup.imageUrl, // Include image URL from original
          link: articleGroup.link,
          totalSubArticles: articleGroup.articles.length,
          collectedAt: articleGroup.collectedAt,
        });

        console.log(
          `Successfully processed article group: ${articleGroup.title}`,
        );
      } catch (error) {
        console.error(
          `Error processing article group "${articleGroup.title}":`,
          error,
        );
        // Continue with next article group even if one fails
      }
    }

    // Save to paraphrasedForTelegramStore
    const telegramData = {
      title: 'Telegram Content Generation',
      totalArticleGroups: processedArticles.length,
      generatedAt: new Date().toISOString(),
      articles: processedArticles,
    };

    await fsPromises.writeFile(
      config.paraphrasedForTelegramStore,
      JSON.stringify(telegramData, null, 2),
    );

    console.log(
      `Successfully generated telegram content for ${processedArticles.length} article groups`,
    );

    return {
      success: true,
      message: 'Telegram content generated successfully',
      totalProcessed: processedArticles.length,
      data: telegramData,
    };
  } catch (error: any) {
    console.error('Error generating telegram content:', error);
    return {
      success: false,
      message: 'Error generating telegram content',
      error: error.message,
    };
  }
};

export {generateTelegramContent};
