import { Router } from "express";
import {
  healthCheck,
  parseText,
  listarDrafts,
  confirmarDraft,
} from "../controllers/aiController";
import { gerarAnaliseFinanceira } from "../controllers/coachController";
import { chatComIA } from "../controllers/chatController";

const router = Router();

// Health check
router.get("/health", healthCheck);

// Endpoints principais
router.post("/ai/parse-text", parseText);
router.get("/drafts", listarDrafts);
router.post("/drafts/:id/confirm", confirmarDraft);

// Coach Financeiro
router.get("/ai/coach", gerarAnaliseFinanceira);

// ✅ NOVO: Chat com IA
router.post("/ai/chat", chatComIA);

export default router;