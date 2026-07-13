import { pgTable, timestamp, uuid, text, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {

    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    name: text("name").notNull().unique(),

});

export const feed = pgTable("feed", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id,
        {
            onDelete: "cascade",
        }),
    lastFetchedAt: timestamp("last_fetched_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const feedFollows = pgTable("feed_Follows", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    feedId: uuid("feed_id").notNull().references(() => feed.id, { onDelete: "cascade" }),

},
(table) =>[unique("user_feed_unique").on(table.userId, table.feedId)])

export type User = typeof users.$inferSelect;
export type Feed = typeof feed.$inferSelect;
export type FeedFollow = typeof feedFollows.$inferSelect;

export const posts = pgTable("posts", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    description: text("description"),
    publishedAt: timestamp("published_at"),
    feedId: uuid("feed_id").notNull().references(() => feed.id, { onDelete: "cascade" }),
});

export type Post = typeof posts.$inferSelect;