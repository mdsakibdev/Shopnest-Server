import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./db.js";
import categoriesRoute from "./routes/categories.js";
import productsRoute from "./routes/products.js";
import reviewsRoute from "./routes/reviews.js";
import ordersRoute from "./routes/orders.js";
import adminRoute from "./routes/admin.js";

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());

// Database connection — starts when the server starts
let dbStatus = "not configured";
if (process.env.MONGODB_URI) {
  connectDB()
    .then(() => {
      dbStatus = "connected";
    })
    .catch((err) => {
      dbStatus = "failed";
      console.log("ShopNest MongoDB failed:", err.message);
    });
}

// routes
app.use("/api/categories", categoriesRoute);
app.use("/api/products", productsRoute);
app.use("/api/reviews", reviewsRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/admin", adminRoute);

app.get("/", (req, res) => {
  res.send({ message: "ShopNest server is running" });
});

app.get("/api/health", (req, res) => {
  res.send({ status: "ok", db: dbStatus });
});

// Run the server locally (Vercel uses the exported app instead)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`ShopNest server is running on port ${port}`);
  });
}

export default app;
