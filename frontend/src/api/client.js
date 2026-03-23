// NeuralOps — API Client
import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

export async function routeRequest(text) {
  try {
    const res = await api.post("/route", { text });
    return res.data;
  } catch (err) {
    console.error("[API] routeRequest failed:", err.message);
    return null;
  }
}

export async function runBattle(text) {
  try {
    const res = await api.post("/battle", { text });
    return res.data;
  } catch (err) {
    console.error("[API] runBattle failed:", err.message);
    return null;
  }
}

export async function getStats() {
  try {
    const res = await api.get("/stats");
    return res.data;
  } catch (err) {
    console.error("[API] getStats failed:", err.message);
    return null;
  }
}

export async function getHistory(limit = 20, offset = 0) {
  try {
    const res = await api.get("/history", { params: { limit, offset } });
    return res.data;
  } catch (err) {
    console.error("[API] getHistory failed:", err.message);
    return null;
  }
}

export async function toggleHealth(model_key, healthy) {
  try {
    const res = await api.post("/health/toggle", { model_key, healthy });
    return res.data;
  } catch (err) {
    console.error("[API] toggleHealth failed:", err.message);
    return null;
  }
}

export async function getHealth() {
  try {
    const res = await api.get("/health");
    return res.data;
  } catch (err) {
    console.error("[API] getHealth failed:", err.message);
    return null;
  }
}