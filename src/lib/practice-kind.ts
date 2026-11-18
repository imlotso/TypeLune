import type { ArticleSnapshot } from './models';
import { lessonForArticle } from './lessons';
import { isAssessmentArticle, isWeakKeyArticle } from './assessment';

// Course material also runs locally; it keeps its course difficulty label.
export function isCustomPracticeArticle(article?: ArticleSnapshot, custom = article?.custom ?? false) {
  return custom && !lessonForArticle(article) && !isAssessmentArticle(article) && !isWeakKeyArticle(article);
}
