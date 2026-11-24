import express from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// GET /api/banners — public. The home hero slider reads this.
// Optional: ?active=true shows only the banners the admin switched on.
router.get("/", async (req, res) => {
  const banners = getCollection("banners");
  if (!banners) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const query = {};
  if (req.query.active === "true") {
    query.active = true;
  }

  const result = await banners
    .find(query)
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  res.send(result);
});

// POST /api/banners — admin only
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  const banners = getCollection("banners");
  if (!banners) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const { title, image, subtitle, buttonText, link, order, active } =
    req.body;
  if (!title || !image) {
    return res
      .status(400)
      .send({ message: "Title and image are required" });
  }

  const count = await banners.countDocuments();
  const newBanner = {
    title,
    image,
    subtitle: subtitle || "",
    buttonText: buttonText || "Shop Now",
    link: link || "/shop",
    order: order !== undefined && order !== "" ? Number(order) : count + 1,
    active: active === undefined ? true : Boolean(active),
    createdAt: new Date(),
  };

  const result = await banners.insertOne(newBanner);
  res.status(201).send({ insertedId: result.insertedId, ...newBanner });
});

// PUT /api/banners/:id — admin only
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const banners = getCollection("banners");
  if (!banners) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Banner not found" });
  }

  const { title, image, subtitle, buttonText, link, order, active } =
    req.body;
  const update = {};
  if (title !== undefined) update.title = title;
  if (image !== undefined) update.image = image;
  if (subtitle !== undefined) update.subtitle = subtitle;
  if (buttonText !== undefined) update.buttonText = buttonText;
  if (link !== undefined) update.link = link;
  if (order !== undefined && order !== "") update.order = Number(order);
  if (active !== undefined) update.active = Boolean(active);

  const result = await banners.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: update }
  );
  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Banner not found" });
  }
  res.send({ message: "Banner updated" });
});

// DELETE /api/banners/:id — admin only
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const banners = getCollection("banners");
  if (!banners) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Banner not found" });
  }

  const result = await banners.deleteOne({
    _id: new ObjectId(req.params.id),
  });
  if (result.deletedCount === 0) {
    return res.status(404).send({ message: "Banner not found" });
  }
  res.send({ message: "Banner deleted" });
});

export default router;
