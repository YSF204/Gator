import { db } from "../index.js"
import { feed, feedFollows , users } from "../../../schema.js"
import { eq , and } from "drizzle-orm";

export async function createFeedFollow(userId: string, feedId: string) {
    const [inserted] = await db.insert(feedFollows).values({
        userId,
        feedId,
    }).returning();


    const [result] = await db.select({
        id: feedFollows.id,
        createdAt: feedFollows.createdAt,
        updatedAt: feedFollows.updatedAt,
        userId: feedFollows.userId,
        feedId: feedFollows.feedId,
        userName: users.name,
        feedName: feed.name,


    }).from(feedFollows).innerJoin(users, eq(feedFollows.userId, users.id))
        .innerJoin(feed, eq(feedFollows.feedId, feed.id))
        .where(eq(feedFollows.id, inserted.id));

    return result;

};
export async function getFeedFollowsForUser(userId : string , ){

    return await db.select({
      id: feedFollows.id,
      createdAt: feedFollows.createdAt,
      updatedAt: feedFollows.updatedAt,
      userId: feedFollows.userId,
      feedId: feedFollows.feedId,
      userName: users.name,
      feedName: feed.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feed, eq(feedFollows.feedId, feed.id))
    .where(eq(feedFollows.userId, userId));


}

export async function deleteFeedFollow(userId: string, feedUrl: string) {
  const [targetFeed] = await db
    .select({ id: feed.id })
    .from(feed)
    .where(eq(feed.url, feedUrl));

  if (!targetFeed) {
    throw new Error(`Feed with URL '${feedUrl}' does not exist.`);
  }

  await db
    .delete(feedFollows)
    .where(
      and(
        eq(feedFollows.userId, userId),
        eq(feedFollows.feedId, targetFeed.id)
      )
    );
}
