import express from "express";
import { ObjectId } from "mongodb";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// Delivery charges for now — in Step 14 these move into the admin
// Settings, so each shop owner can change them.
const DELIVERY_INSIDE_DHAKA = 60;
const DELIVERY_OUTSIDE_DHAKA = 120;

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

// Checkout works for guests too. If the customer IS logged in, we
// quietly read their email from the token (no error if there is no
// token — the order is simply saved without an account link).
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${CLIENT_URL}/api/auth/jwks`));

async function tryGetUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(authHeader.split(" ")[1], JWKS, {
      issuer: CLIENT_URL,
      audience: CLIENT_URL,
    });
    return payload;
  } catch {
    return null;
  }
}

// POST /api/orders — place an order (guests allowed).
// Prices are taken from the database here, never trusted from the
// browser, and stock is checked before the order is saved.
router.post("/", async (req, res) => {
  const orders = getCollection("orders");
  const products = getCollection("products");
  if (!orders || !products) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const {
    customerName,
    phone,
    address,
    area,
    items,
    paymentMethod,
    bkashNumber,
    bkashTrxId,
  } = req.body;

  if (!customerName || !customerName.trim()) {
    return res.status(400).send({ message: "Your name is required" });
  }
  if (!phone || phone.trim().length < 11) {
    return res
      .status(400)
      .send({ message: "Please give a valid mobile number" });
  }
  if (!address || !address.trim()) {
    return res.status(400).send({ message: "Your address is required" });
  }
  if (area !== "inside" && area !== "outside") {
    return res
      .status(400)
      .send({ message: "Please choose your delivery area" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).send({ message: "Your cart is empty" });
  }

  const method = paymentMethod === "bkash" ? "bkash" : "cod";
  if (method === "bkash" && (!bkashNumber || !bkashTrxId)) {
    return res.status(400).send({
      message: "Please give your bKash number and transaction ID",
    });
  }

  // Check every item against the database and build the order lines
  const orderItems = [];
  let subtotal = 0;
  for (const item of items) {
    if (!item.productId || !ObjectId.isValid(item.productId)) {
      return res.status(400).send({ message: "One cart item is not valid" });
    }
    const product = await products.findOne({
      _id: new ObjectId(item.productId),
    });
    if (!product) {
      return res
        .status(400)
        .send({ message: "One item is no longer available" });
    }
    const quantity = Math.max(1, Number(item.quantity) || 1);
    if (product.stock < quantity) {
      return res.status(400).send({
        message: `${product.name} does not have enough stock left`,
      });
    }
    const price = product.discountPrice || product.price;
    orderItems.push({
      productId: product._id,
      name: product.name,
      image: product.images[0] || "",
      price,
      size: item.size || "",
      colour: item.colour || "",
      quantity,
    });
    subtotal += price * quantity;
  }

  const deliveryCharge =
    area === "inside" ? DELIVERY_INSIDE_DHAKA : DELIVERY_OUTSIDE_DHAKA;

  const user = await tryGetUser(req);

  const newOrder = {
    customerName: customerName.trim(),
    phone: phone.trim(),
    address: address.trim(),
    area,
    items: orderItems,
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    paymentMethod: method,
    bkashNumber: method === "bkash" ? bkashNumber.trim() : "",
    bkashTrxId: method === "bkash" ? bkashTrxId.trim() : "",
    paymentStatus: method === "bkash" ? "pending-verify" : "unpaid",
    status: "pending",
    userEmail: user?.email || null,
    createdAt: new Date(),
  };

  const result = await orders.insertOne(newOrder);

  // Take the ordered quantities out of stock and count them as sold
  for (const item of orderItems) {
    await products.updateOne(
      { _id: item.productId },
      { $inc: { stock: -item.quantity, sold: item.quantity } }
    );
  }

  res.status(201).send({
    orderId: result.insertedId,
    total: newOrder.total,
    status: newOrder.status,
  });
});

// GET /api/orders/track/:id — public order tracking.
// Returns only safe fields (never the address or phone).
router.get("/track/:id", async (req, res) => {
  const orders = getCollection("orders");
  if (!orders) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Order not found" });
  }

  const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
  if (!order) {
    return res.status(404).send({ message: "Order not found" });
  }

  res.send({
    _id: order._id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt,
  });
});

// GET /api/orders/my — the logged-in customer's own orders
router.get("/my", verifyToken, async (req, res) => {
  const orders = getCollection("orders");
  if (!orders) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const result = await orders
    .find({ userEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

// GET /api/orders — admin only, all orders (newest first),
// optionally filtered with ?status=pending etc.
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  const orders = getCollection("orders");
  if (!orders) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const query = {};
  if (req.query.status && ORDER_STATUSES.includes(req.query.status)) {
    query.status = req.query.status;
  }

  const result = await orders.find(query).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// PUT /api/orders/:id/status — admin only, change the order status
router.put("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  const orders = getCollection("orders");
  if (!orders) {
    return res.status(500).send({ message: "Database not connected" });
  }

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Order not found" });
  }
  if (!ORDER_STATUSES.includes(req.body.status)) {
    return res.status(400).send({ message: "Invalid status" });
  }

  const result = await orders.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: req.body.status } }
  );
  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Order not found" });
  }
  res.send({ message: "Status updated" });
});

// PUT /api/orders/:id/payment — admin only, e.g. mark a bKash
// payment "paid" after checking the transaction ID
router.put("/:id/payment", verifyToken, verifyAdmin, async (req, res) => {
  const orders = getCollection("orders");
  if (!orders) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const PAYMENT_STATUSES = ["unpaid", "pending-verify", "paid", "failed"];
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).send({ message: "Order not found" });
  }
  if (!PAYMENT_STATUSES.includes(req.body.paymentStatus)) {
    return res.status(400).send({ message: "Invalid payment status" });
  }

  const result = await orders.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { paymentStatus: req.body.paymentStatus } }
  );
  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Order not found" });
  }
  res.send({ message: "Payment status updated" });
});

export default router;
