import { MongoClient } from "mongodb";

// One shared database for the whole server.
// All route files get their collections from here.
// The client is created inside connectDB (not at the top),
// so the server can still start if MONGODB_URI is missing.
let client = null;
let db = null;

// Small helper: wait a few seconds between connection tries
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The free Atlas cluster sometimes does not answer on the first try
// (the connection times out), so we try a few times before giving up.
// Once one try succeeds, the server stays connected.
export async function connectDB() {
  if (db) return db;

  const totalTries = 6;
  for (let attempt = 1; attempt <= totalTries; attempt++) {
    try {
      client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 20000,
      });
      await client.connect();
      db = client.db("shopnest");
      console.log("ShopNest MongoDB connected");
      return db;
    } catch (err) {
      console.log(
        `ShopNest MongoDB try ${attempt}/${totalTries} failed:`,
        err.message
      );
      // Close the half-open connection before the next try
      if (client) {
        try {
          await client.close();
        } catch {
          // nothing to close — ignore
        }
        client = null;
      }
      if (attempt < totalTries) {
        await wait(5000);
      }
    }
  }

  // All tries failed — index.js will mark the status as "failed"
  throw new Error("Could not connect to MongoDB after several tries");
}

// Returns one collection, for example getCollection("categories")
export function getCollection(name) {
  if (!db) return null;
  return db.collection(name);
}
