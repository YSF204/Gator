import { db } from "../index.js";
import { feed } from "../../../schema.js";
import { eq, sql } from "drizzle-orm";
import { users } from "../../../schema.js";

export async function createFeed(name:string , url : string,userId : string){

    const [result] = await db.insert(feed).values({
        name : name,
        url : url,
        userId : userId,
    }).returning();
    return result;

}

export async function getAllFeedsWithUsers(){
    const result = await db.select().from(feed).innerJoin(users, eq(feed.userId, users.id));
    return result;
}

export async function getFeedByUrl(url: string) {
  const [result] = await db
    .select()
    .from(feed)
    .where(eq(feed.url, url));
  return result;
}

export async function markFeedFetched(feedId: string) {
  const [result] = await db
    .update(feed)
    .set({
      lastFetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feed.id, feedId))
    .returning();
  return result;
}

export async function getNextFeedToFetch() {
  const [result] = await db
    .select()
    .from(feed)
    .orderBy(sql`${feed.lastFetchedAt} ASC NULLS FIRST`)
    .limit(1);
  return result || null;
}
