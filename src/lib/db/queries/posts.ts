import { db } from "../index.js";
import { posts, feedFollows } from "../../../schema.js";
import { eq, desc } from "drizzle-orm";

export async function createPost(postData: {
  title: string;
  url: string;
  description: string | null;
  publishedAt: Date | null;
  feedId: string;
}) {
  const [result] = await db
    .insert(posts)
    .values({
      title: postData.title,
      url: postData.url,
      description: postData.description,
      publishedAt: postData.publishedAt,
      feedId: postData.feedId,
    })
    .onConflictDoNothing()
    .returning();
  return result || null;
}

export async function getPostsForUser(userId: string, limit: number) {
  const results = await db
    .select({
      id: posts.id,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedId: posts.feedId,
    })
    .from(posts)
    .innerJoin(feedFollows, eq(posts.feedId, feedFollows.feedId))
    .where(eq(feedFollows.userId, userId))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
  return results;
}
