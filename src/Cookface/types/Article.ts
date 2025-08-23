export interface Article {
  subheading: string | null;
  timestamp: string | null;
  content: string | null;
  divIndex: number | null;
}

export interface ArticleHeadline {
  headline: string | null;
  link: string | null;
  imageUrl: string | null;
  index: number | null;
}

export interface TelegramArticle {
  initialTitle: string;
  telegramTitle: string;
  telegramContent: string;
  imageUrl: string;
  link: string;
  totalSubArticles: number;
  collectedAt: string;
}
