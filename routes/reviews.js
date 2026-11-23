import express from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// GET /api/reviews?productId=... — public, newest first
router.get("/", async (req, res) => {
  const reviews = getCollection("reviews");
  if (!reviews) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const query = {};
  if (req.query.productId) {
    if (!ObjectId.isValid(req.query.productId)) {
      return res.send([]);
    }
    query.productId = new ObjectId(req.query.productId);
  }

  const result = await reviews.find(query).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// POST /api/reviews — logged-in users only.
// One review per user for the same product.
router.post("/", verifyToken, async (req, res) => {
  const reviews = getCollection("reviews");
  const products = getCollection("products");
  if (!reviews || !products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const { productId, rating, comment } = req.body;

  if (!productId || !ObjectId.isValid(productId)) {
    return res.status(400).send({ message: "Valid productId is required" });
  }
  const ratingNumber = Number(rating);
  if (!ratingNumber || ratingNumber < 1 || ratingNumber > 5) {
    return res.status(400).send({ message: "Rating must be between 1 and 5" });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).send({ message: "Please write a short comment" });
  }

  const product = await products.findOne({ _id: new ObjectId(productId) });
  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }

  const userId = req.user.sub;
  const existing = await reviews.findOne({
    productId: new ObjectId(productId),
    userId,
  });
  if (existing) {
    return res
      .status(400)
      .send({ message: "You have already reviewed this product" });
  }

  const newReview = {
    productId: new ObjectId(productId),
    userId,
    userName: req.user.name || req.user.email || "Customer",
    rating: ratingNumber,
    comment: comment.trim(),
    createdAt: new Date(),
  };

  const result = await reviews.insertOne(newReview);
  res.status(201).send({ insertedId: result.insertedId, ...newReview });
});

// DELETE /api/reviews/:id — admin only (moderation, used in Step 13)
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const reviews = getCollection("reviews");
  if (!reviews) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Review not found" });
  }

  const result = await reviews.deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0) {
    return res.status(404).send({ message: "Review not found" });
  }
  res.send({ message: "Review deleted" });
});

export default router;
