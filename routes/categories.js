import express from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// Turn a name into a slug: "Pant & Trouser" -> "pant-trouser"
function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/categories — public. Optional: ?section=men or ?section=women
router.get("/", async (req, res) => {
  const categories = getCollection("categories");
  if (!categories) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const query = {};
  if (req.query.section) {
    query.section = req.query.section;
  }

  const result = await categories
    .find(query)
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  res.send(result);
});

// POST /api/categories — admin only
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  const categories = getCollection("categories");
  if (!categories) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const { name, section, image } = req.body;
  if (!name || !section) {
    return res.status(400).send({ message: "Name and section are required" });
  }
  if (section !== "men" && section !== "women") {
    return res.status(400).send({ message: "Section must be men or women" });
  }

  const slug = makeSlug(name);

  // One category can not be added twice in the same section
  const exists = await categories.findOne({ slug, section });
  if (exists) {
    return res.status(400).send({ message: "This category already exists" });
  }

  const count = await categories.countDocuments();

  const newCategory = {
    name,
    slug,
    section,
    image: image || "",
    order: count + 1,
    createdAt: new Date(),
  };

  const result = await categories.insertOne(newCategory);
  res.status(201).send({ insertedId: result.insertedId, ...newCategory });
});

// PUT /api/categories/:id — admin only
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const categories = getCollection("categories");
  if (!categories) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const { name, section, image, order } = req.body;
  const update = {};
  if (name) {
    update.name = name;
    update.slug = makeSlug(name);
  }
  if (section) update.section = section;
  if (image !== undefined) update.image = image;
  if (order !== undefined) update.order = Number(order);

  const result = await categories.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Category not found" });
  }
  res.send({ message: "Category updated" });
});

// DELETE /api/categories/:id — admin only
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const categories = getCollection("categories");
  if (!categories) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const result = await categories.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (result.deletedCount === 0) {
    return res.status(404).send({ message: "Category not found" });
  }
  res.send({ message: "Category deleted" });
});

export default router;
