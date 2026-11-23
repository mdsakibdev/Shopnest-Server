import express from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// Turn a name into a slug: "Cotton Panjabi - Eid" -> "cotton-panjabi-eid"
function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sizes / colours can come as an array ["M", "L"] or as text "M, L, XL"
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim());
  }
  return [];
}

// GET /api/products — public
// Filters: ?section=men&women, ?category=saree, ?search=panjabi,
// ?featured=true, ?flashSale=true
// Sort: ?sort=newest (default), price-low, price-high
// Pagination: ?page=1&limit=12
// Returns: { products, total, page, totalPages }
router.get("/", async (req, res) => {
  const products = getCollection("products");
  if (!products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const query = {};
  if (req.query.section) query.section = req.query.section;
  if (req.query.category) query.category = req.query.category;
  if (req.query.featured === "true") query.featured = true;
  if (req.query.flashSale === "true") query.flashSale = true;
  if (req.query.search) {
    query.name = { $regex: req.query.search, $options: "i" };
  }

  let sort = { createdAt: -1 };
  if (req.query.sort === "price-low") sort = { price: 1 };
  if (req.query.sort === "price-high") sort = { price: -1 };

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;

  const total = await products.countDocuments(query);
  const result = await products
    .find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  res.send({
    products: result,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/products/:id — public, one product for the details page
router.get("/:id", async (req, res) => {
  const products = getCollection("products");
  if (!products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Product not found" });
  }

  const product = await products.findOne({ _id: new ObjectId(req.params.id) });
  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }
  res.send(product);
});

// POST /api/products — admin only
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  const products = getCollection("products");
  if (!products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const {
    name,
    description,
    price,
    discountPrice,
    category,
    section,
    images,
    sizes,
    colours,
    stock,
    featured,
    flashSale,
  } = req.body;

  if (!name || !price || !category || !section) {
    return res
      .status(400)
      .send({ message: "Name, price, category and section are required" });
  }
  if (section !== "men" && section !== "women") {
    return res.status(400).send({ message: "Section must be men or women" });
  }

  const slug = makeSlug(name);
  const exists = await products.findOne({ slug });
  if (exists) {
    return res
      .status(400)
      .send({ message: "A product with this name already exists" });
  }

  const newProduct = {
    name,
    slug,
    description: description || "",
    price: Number(price),
    discountPrice: discountPrice ? Number(discountPrice) : null,
    category,
    section,
    images: toArray(images),
    sizes: toArray(sizes),
    colours: toArray(colours),
    stock: Number(stock) || 0,
    featured: Boolean(featured),
    flashSale: Boolean(flashSale),
    sold: 0,
    createdAt: new Date(),
  };

  const result = await products.insertOne(newProduct);
  res.status(201).send({ insertedId: result.insertedId, ...newProduct });
});

// PUT /api/products/:id — admin only
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const products = getCollection("products");
  if (!products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Product not found" });
  }

  const body = req.body;
  const update = {};
  if (body.name) {
    update.name = body.name;
    update.slug = makeSlug(body.name);
  }
  if (body.description !== undefined) update.description = body.description;
  if (body.price !== undefined) update.price = Number(body.price);
  if (body.discountPrice !== undefined) {
    update.discountPrice = body.discountPrice
      ? Number(body.discountPrice)
      : null;
  }
  if (body.category) update.category = body.category;
  if (body.section) update.section = body.section;
  if (body.images !== undefined) update.images = toArray(body.images);
  if (body.sizes !== undefined) update.sizes = toArray(body.sizes);
  if (body.colours !== undefined) update.colours = toArray(body.colours);
  if (body.stock !== undefined) update.stock = Number(body.stock);
  if (body.featured !== undefined) update.featured = Boolean(body.featured);
  if (body.flashSale !== undefined) update.flashSale = Boolean(body.flashSale);

  const result = await products.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Product not found" });
  }
  res.send({ message: "Product updated" });
});

// DELETE /api/products/:id — admin only
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const products = getCollection("products");
  if (!products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Product not found" });
  }

  const result = await products.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (result.deletedCount === 0) {
    return res.status(404).send({ message: "Product not found" });
  }
  res.send({ message: "Product deleted" });
});

export default router;
