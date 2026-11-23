import express from "express";
import { getCollection } from "../db.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";

const router = express.Router();

// GET /api/admin/stats — admin only.
// The numbers for the admin dashboard cards. Revenue counts every
// order except cancelled ones.
router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  const orders = getCollection("orders");
  const products = getCollection("products");
  const users = getCollection("user");
  if (!orders || !products || !users) {
    return res.status(500).send({ message: "Database not connected" });
  }

  const allOrders = await orders
    .find({}, { projection: { total: 1, status: 1 } })
    .toArray();

  const revenue = allOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + (order.total || 0), 0);

  const totalOrders = allOrders.length;
  const pendingOrders = allOrders.filter(
    (order) => order.status === "pending"
  ).length;
  const totalProducts = await products.countDocuments();
  const totalCustomers = await users.countDocuments({ role: "customer" });

  res.send({
    totalOrders,
    revenue,
    pendingOrders,
    totalProducts,
    totalCustomers,
  });
});

export default router;
