import { readConfig, setUser } from "./config.js";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { createUser, getUserByName, deleteAllUsers, getAllUser } from "./lib/db/queries/users.js";
import { XMLParser } from "fast-xml-parser";
import { createFeed, getAllFeedsWithUsers, getFeedByUrl, markFeedFetched, getNextFeedToFetch } from "./lib/db/queries/feeds.js";
import { User, Feed } from "./schema.js";
import { createFeedFollow, getFeedFollowsForUser,deleteFeedFollow } from "./lib/db/queries/feed_follows.js";
import { createPost, getPostsForUser } from "./lib/db/queries/posts.js";




interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

interface RSSFeed {
  title: string;
  link: string;
  description: string;
  items: RSSItem[];
}

type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;


type UserCommandHandler =  (
  cmdName : string,
  user : User,
  ...args : string[]

) => Promise<void>


type CommandsRegistry = Record<string, CommandHandler>;

async function handlerUnfollow(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 1) {
    throw new Error("The unfollow command requires a feed URL argument.");
  }
  const url = args[0];

  await deleteFeedFollow(user.id, url);

  console.log(`Successfully unfollowed feed at ${url}`);
}


function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const cfg = readConfig();
    const currentUserName = cfg.current_user_name;
    if (!currentUserName) {
      throw new Error("No user is currently logged in. Please login or register first.");
    }
    const user = await getUserByName(currentUserName);
    if (!user) {
      throw new Error(`Current user '${currentUserName}' was not found in the database.`);
    }
    return handler(cmdName, user, ...args);
  };
}
async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator"
    },
  });
  if (!response.ok) {
    throw new Error(`failed to fetch feed : ${response.statusText}`);

  }

  const xmlText = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,

  });

  const parsed = parser.parse(xmlText);

  const channel = parsed.rss?.channel || parsed.channel;
  if (!channel) {
    throw new Error("Invalid RSS feed: channel field is missing");
  }

  const title = channel.title;
  const link = channel.link;
  const description = channel.description;


  if (
    typeof title !== "string" ||
    typeof link !== "string" ||
    typeof description !== "string"
  ) {
    throw new Error("Invalid RSS feed: channel metadata fields are missing or invalid");
  }

  let rawItems: any = [];
  if (channel.item) {
    if (Array.isArray(channel.item)) {
      rawItems = channel.item;
    } else {
      rawItems = [channel.item];
    }
  }

  const items: RSSItem[] = [];

  for (const rawItem of rawItems) {
    const itemTitle = rawItem.title;
    const itemLink = rawItem.link;
    const itemDescription = rawItem.description;
    const itemPubDate = rawItem.pubDate;

    if (
      typeof itemTitle !== "string" ||
      typeof itemLink !== "string" ||
      typeof itemDescription !== "string" ||
      typeof itemPubDate !== "string"
    ) {
      continue;
    }
    items.push({
      title: itemTitle,
      link: itemLink,
      description: itemDescription,
      pubDate: itemPubDate,
    });
  }

  return {
    title,
    link,
    description,
    items,
  } as RSSFeed;
};

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);
  if (!match) {
    throw new Error(`Invalid duration string: "${durationStr}". Expected formats like 10s, 5m, 2h.`);
  }
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "ms") return val;
  if (unit === "s") return val * 1000;
  if (unit === "m") return val * 60 * 1000;
  if (unit === "h") return val * 60 * 60 * 1000;
  return 0;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  let result = "";
  if (hours > 0) {
    result += `${hours}h`;
  }
  if (minutes > 0 || hours > 0) {
    result += `${minutes}m`;
  }
  result += `${seconds}s`;
  return result;
}

async function scrapeFeeds() {
  const nextFeed = await getNextFeedToFetch();
  if (!nextFeed) {
    console.log("No feeds to fetch.");
    return;
  }

  console.log(`Fetching feed: ${nextFeed.name} (${nextFeed.url})`);
  try {
    const rssFeed = await fetchFeed(nextFeed.url);
    await markFeedFetched(nextFeed.id);

    let savedCount = 0;
    for (const item of rssFeed.items) {
      let publishedAt: Date | null = null;
      if (item.pubDate) {
        const parsedDate = Date.parse(item.pubDate);
        if (!isNaN(parsedDate)) {
          publishedAt = new Date(parsedDate);
        }
      }

      const savedPost = await createPost({
        title: item.title,
        url: item.link,
        description: item.description || null,
        publishedAt: publishedAt,
        feedId: nextFeed.id,
      });

      if (savedPost) {
        savedCount++;
      }
    }
    console.log(`Scraped ${rssFeed.items.length} items from ${nextFeed.name}, saved ${savedCount} new posts.`);
  } catch (err) {
    console.error(`Error scraping feed '${nextFeed.name}': ${(err as Error).message}`);
    // Still mark it fetched so it moves to the end of the queue and doesn't block other feeds
    await markFeedFetched(nextFeed.id);
  }
}

async function handlerAgg(cmdName: string, ...args: string[]) {
  if (args.length < 1) {
    throw new Error("The agg command requires a time_between_reqs argument (e.g., 1s, 1m, 1h).");
  }
  const durationStr = args[0];
  const timeBetweenRequests = parseDuration(durationStr);
  
  console.log(`Collecting feeds every ${formatDuration(timeBetweenRequests)}`);

  const handleError = (err: any) => {
    console.error(`Error scraping feeds: ${(err as Error).message}`);
  };

  await scrapeFeeds().catch(handleError);

  const interval = setInterval(() => {
    scrapeFeeds().catch(handleError);
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("\nShutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

async function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
) {
  registry[cmdName] = handler;

}
async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
) {
  const handler = registry[cmdName];
  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`)
  }
  await handler(cmdName, ...args);
}

async function handlerReset(cmdName: string, ...args: string[]) {
  try {
    await deleteAllUsers();
    console.log("All users deleted successfully");
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);

  }

}


async function handlerList(cmdName: string, ...args: string[]) {
  const users = await getAllUser();
  const cfg = readConfig();
  const current = cfg.current_user_name;

  for (const user of users) {
    if (user.name === current) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`*  ${user.name}`);
    }
  }


}

async function handlerFeed(cmdName: string, ...args: string[]) {
  try {
    const feedsWithUsers = await getAllFeedsWithUsers();
    if (feedsWithUsers.length === 0) {
      console.log("No feeds found in the database.");
      return;
    }
    for (const item of feedsWithUsers) {
      console.log(`* Name:       ${item.feed.name}`);
      console.log(`  URL:        ${item.feed.url}`);
      console.log(`  Created by: ${item.users.name}`);
      console.log("------------------------");
    }
  } catch (err) {
    console.error(`Error listing feeds: ${(err as Error).message}`);
  }
}
///// LOGIN ,...///
async function handlerLogin(cmdName: string, ...args: string[]) {

  if (args.length === 0) {
    throw new Error("Login requiers a username argument");

  }
  const username = args[0];

  // check if the user exists 
  const user = await getUserByName(username);
  if (!user) {
    throw new Error(`User ${username} does not exist`)
  }
  const cfg = readConfig();
  setUser(cfg, username);
  console.log(`User set to ${username}`);
}

//// REGISTER ....///

async function handlerRegister(cmdName: string, ...args: string[]) {
  if (args.length === 0) {
    throw new Error("REGISTER command needs arguments")
  }

  const name = args[0];
  const existUser = await getUserByName(name);
  if (existUser) {
    throw new Error(`User ${name} already exists`)
  }
  const user = await createUser(name);

  const cfg = readConfig();
  setUser(cfg, name);
  console.log(`User ${name} registered successfully`);
  console.log(user);

}


function printFeed(feed: Feed, user: User) {
  console.log("Feed Record Created Successfully:");
  console.log(`* Name:    ${feed.name}`);
  console.log(`* URL:     ${feed.url}`);
  console.log(`* User ID: ${feed.userId}`);
  console.log(`* Owner:   ${user.name}`);
};

async function handlerAddFeed(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 2) {
    throw new Error("The addfeed command requires two arguments: <name> and <url>");
  }
  const [name, url] = args;
  
  const feed = await createFeed(name, url, user.id);
  printFeed(feed, user);
  const followRecord = await createFeedFollow(user.id, feed.id);
  console.log(`* User '${followRecord.userName}' automatically followed feed '${followRecord.feedName}'`);
}

async function handlerFollow(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 1) {
    throw new Error("The follow command requires a feed URL argument.");
  }
  const url = args[0];

  // Find the feed by its URL
  const targetFeed = await getFeedByUrl(url);
  if (!targetFeed) {
    throw new Error(`Feed with URL '${url}' does not exist.`);
  }

  // Create the follow record
  const follow = await createFeedFollow(user.id, targetFeed.id);

  console.log("Successfully followed feed:");
  console.log(`* Feed Name: ${follow.feedName}`);
  console.log(`* User Name: ${follow.userName}`);
}


async function handlerFollowing(cmdName: string, user: User, ...args: string[]) {
  // Fetch all follows
  const follows = await getFeedFollowsForUser(user.id);
  if (follows.length === 0) {
    console.log("You are not following any feeds yet.");
    return;
  }

  console.log(`Feeds followed by '${user.name}':`);
  for (const follow of follows) {
    console.log(`* ${follow.feedName}`);
  }
}

async function handlerBrowse(cmdName: string, user: User, ...args: string[]) {
  let limit = 2;
  if (args.length > 0) {
    const parsedLimit = parseInt(args[0], 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit;
    } else {
      throw new Error("Invalid limit. Please specify a positive integer.");
    }
  }

  const posts = await getPostsForUser(user.id, limit);
  if (posts.length === 0) {
    console.log("No posts found. Make sure you are following feeds and that the aggregator has run.");
    return;
  }

  console.log(`Showing the latest ${posts.length} posts for user '${user.name}':`);
  for (const post of posts) {
    console.log(`\n========================================`);
    console.log(`Title:       ${post.title}`);
    console.log(`Published:   ${post.publishedAt ? post.publishedAt.toLocaleString() : "Unknown"}`);
    console.log(`Link:        ${post.url}`);
    console.log(`Description: ${post.description || "No description"}`);
    console.log(`========================================`);
  }
}


//// main /////

async function main() {


  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerList);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "feeds", handlerFeed);
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));




  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Error: no command provided");
    process.exit(1);
  }
  const cmdName = args[0];
  const cmdArgs = args.slice(1);
  try {
    await runCommand(registry, cmdName, ...cmdArgs);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  process.exit(0);
}

main();