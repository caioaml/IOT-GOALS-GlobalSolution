import { Router } from "express";
import aiRoutes from "./aiRoutes";

const router = Router();

router.use(aiRoutes);

export default router;