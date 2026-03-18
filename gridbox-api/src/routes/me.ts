import { Router } from "express";
import { mockUser } from "../data/mockData";

const router = Router();

router.get("/portal/me", (_req, res) => {
  res.json(mockUser);
});

export default router;
