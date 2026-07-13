# Gator

Gator is a command-line RSS feed aggregator written in TypeScript. It allows you to register RSS feeds, follow/unfollow them under different user accounts, and periodically scrape and browse posts.

## Prerequisites

To run this CLI, you will need:
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** database

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure the application**
   Create a configuration file named `.gatorconfig.json` in your user's home directory (e.g., `~/.gatorconfig.json` on macOS/Linux). Add your PostgreSQL connection URL to it:
   ```json
   {
     "db_url": "postgres://username:password@localhost:5432/database_name?sslmode=disable"
   }
   ```

3. **Initialize the database**
   Push the schema to your PostgreSQL database using Drizzle Kit:
   ```bash
   npx drizzle-kit push
   ```

## Running the CLI

You can execute commands using `npm start` followed by the command name and any arguments:

```bash
npm start <command> [arguments]
```

### Commands

Here are some of the main commands you can run:

#### User Management
- **Register a user:**
  ```bash
  npm start register <username>
  ```
- **Login as an existing user:**
  ```bash
  npm start login <username>
  ```
- **List all users** (shows the currently active user):
  ```bash
  npm start users
  ```

#### Feed Management
- **Add a feed** (registers the feed and automatically follows it):
  ```bash
  npm start addfeed <feed_name> <feed_url>
  ```
- **List all registered feeds:**
  ```bash
  npm start feeds
  ```
- **Follow a feed:**
  ```bash
  npm start follow <feed_url>
  ```
- **Unfollow a feed:**
  ```bash
  npm start unfollow <feed_url>
  ```
- **List feeds you are following:**
  ```bash
  npm start following
  ```

#### Aggregator & Reader
- **Start the aggregator** (runs a loop fetching posts at the specified interval, e.g., `10s`, `5m`, `1h`):
  ```bash
  npm start agg 1m
  ```
- **Browse posts** (shows the latest posts from feeds you follow; defaults to 2 posts, or specify a limit):
  ```bash
  npm start browse 10
  ```
