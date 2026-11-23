import { MongoClient } from "mongodb";

// One shared database for the whole server.
// All route files get their collections from here.
// The client is created inside connectDB (not at the top),
// so the server can still start if MONGODB_URI is missing.
let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db("shopnest");
  console.log("ShopNest MongoDB connected");
  return db;
}

// Returns one collection, for example getCollection("categories")
export function getCollection(name) {
  if (!db) return null;
  return db.collection(name);
}