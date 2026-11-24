import express from "express";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// The shop's settings live in ONE document in the "settings"
// collection. Until the admin saves them once, these defaults are
// used — the same values the site used before Step 14.
export const DEFAULT_SETTINGS = {
  shopName: "ShopNest",
  logo: "",
  hotline: "01800-000000",
  email: "support@shopnest.com.bd",
  address: "Dhaka, Bangladesh",
  bkashNumber: "01700-000000",
  deliveryInside: 60,
  deliveryOutside: 120,
  facebook: "",
  instagram: "",
};

// Pick only the known settings fields out of a document, so a stray
// _id or extra field never leaks into the reply.
function toSettings(doc) {
  const out = { ...DEFAULT_SETTINGS };
  if (!doc) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (doc[key] !== undefined && doc[key] !== null) {
      out[key] = doc[key];
    }
  }
  return out;
}

// GET /api/settings — public. Navbar, Footer, checkout and the
// admin page all read from here.
router.get("/", async (req, res) => {
  const settings = getCollection("settings");
  if (!settings) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const doc = await settings.findOne({});
  res.send(toSettings(doc));
});

// PUT /api/settings — admin only. There is only one settings
// document, so this saves over it (upsert: creates it if the admin
// has never saved settings before).
router.put("/", verifyToken, verifyAdmin, async (req, res) => {
  const settings = getCollection("settings");
  if (!settings) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const {
    shopName,
    logo,
    hotline,
    email,
    address,
    bkashNumber,
    deliveryInside,
    deliveryOutside,
    facebook,
    instagram,
  } = req.body;

  if (!shopName || !String(shopName).trim()) {
    return res.status(400).send({ message: "Shop name is required" });
  }

  const inside = Number(deliveryInside);
  const outside = Number(deliveryOutside);
  if (!Number.isFinite(inside) || inside < 0) {
    return res
      .status(400)
      .send({ message: "Inside Dhaka delivery charge must be 0 or more" });
  }
  if (!Number.isFinite(outside) || outside < 0) {
    return res
      .status(400)
      .send({ message: "Outside Dhaka delivery charge must be 0 or more" });
  }

  const update = {
    shopName: String(shopName).trim(),
    logo: logo || "",
    hotline: hotline || "",
    email: email || "",
    address: address || "",
    bkashNumber: bkashNumber || "",
    deliveryInside: inside,
    deliveryOutside: outside,
    facebook: facebook || "",
    instagram: instagram || "",
    updatedAt: new Date(),
  };

  await settings.updateOne({}, { $set: update }, { upsert: true });
  const saved = await settings.findOne({});
  res.send(toSettings(saved));
});

export default router;
