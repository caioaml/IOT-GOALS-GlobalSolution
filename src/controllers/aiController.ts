import { Request, Response } from "express";
import sql from "mssql";
import { getPool } from "../config/db";
import { extrairDadosComIA } from "../services/aiService";

// ========================================
// HEALTH CHECK
// ========================================
export const healthCheck = (req: Request, res: Response) => {
  console.log("✅ Health check OK");
  res.json({
    status: "ok",
    message: "GOALS API rodando",
    timestamp: new Date().toISOString(),
  });
};

// ========================================
// PARSE TEXT COM IA
// ========================================
export const parseText = async (req: Request, res: Response) => {
  try {
    const { userId, texto } = req.body;

    if (!userId || !texto) {
      return res.status(400).json({ error: "userId e texto são obrigatórios" });
    }

    console.log("📝 Parse text com IA Generativa:", { userId, texto });

    // Extrair dados com IA
    const dados = await extrairDadosComIA(texto);

    // Salvar como draft
    const pool = await getPool();

    const result = await pool
      .request()
      .input("UserId", sql.NVarChar(100), userId)
      .input("Valor", sql.Decimal(10, 2), dados.valor)
      .input("Data", sql.Date, dados.data)
      .input("Merchant", sql.NVarChar(200), dados.merchant)
      .input("CategoriaSugerida", sql.NVarChar(50), dados.categoria)
      .input("TextoOriginal", sql.NVarChar(sql.MAX), texto)
      .input("Confidence", sql.Decimal(3, 2), dados.confidence)
      .query(`
        INSERT INTO dbo.Drafts (UserId, Valor, Data, Merchant, CategoriaSugerida, TextoOriginal, Confidence, CriadoEm)
        OUTPUT INSERTED.DraftId
        VALUES (@UserId, @Valor, @Data, @Merchant, @CategoriaSugerida, @TextoOriginal, @Confidence, GETDATE())
      `);

    const draftId = result.recordset[0].DraftId;

    console.log("✅ Draft criado com IA:", {
      draftId,
      valor: dados.valor,
      data: dados.data,
      merchant: dados.merchant,
      categoria: dados.categoria,
      confidence: dados.confidence,
    });

    return res.status(201).json({
      draftId,
      valor: dados.valor,
      data: dados.data,
      merchant: dados.merchant,
      categoria_sugerida: dados.categoria,
      texto_original: texto,
      confidence: dados.confidence,
      ai_powered: true,
    });
  } catch (error: any) {
    console.error("❌ Erro ao criar draft:", error);
    return res.status(500).json({
      error: "Erro ao processar texto",
      details: process.env.NODE_ENV === "dev" ? error.message : undefined,
    });
  }
};

// ========================================
// LISTAR DRAFTS
// ========================================
export const listarDrafts = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório" });
    }

    console.log("📋 Listando drafts para:", userId);

    const pool = await getPool();

    const result = await pool
      .request()
      .input("UserId", sql.NVarChar(100), userId as string)
      .query(`
        SELECT 
          DraftId,
          UserId,
          Valor,
          Data,
          Merchant,
          CategoriaSugerida,
          TextoOriginal,
          Confidence,
          CriadoEm
        FROM dbo.Drafts
        WHERE UserId = @UserId
        ORDER BY CriadoEm DESC
      `);

    return res.json({
      userId,
      total: result.recordset.length,
      items: result.recordset.map(draft => ({
        draftId: draft.DraftId,
        valor: draft.Valor,
        data: draft.Data,
        merchant: draft.Merchant,
        categoria_sugerida: draft.CategoriaSugerida,
        texto_original: draft.TextoOriginal,
        confidence: draft.Confidence,
        createdAt: draft.CriadoEm,
      })),
    });
  } catch (error: any) {
    console.error("❌ Erro ao listar drafts:", error);
    return res.status(500).json({
      error: "Erro ao listar drafts",
      details: process.env.NODE_ENV === "dev" ? error.message : undefined,
    });
  }
};

// ========================================
// CONFIRMAR DRAFT (SALVAR NO BANCO)
// ========================================
export const confirmarDraft = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoria, valor, conta, descricao, data } = req.body;

    if (!categoria || !valor || !conta) {
      return res.status(400).json({ 
        error: "categoria, valor e conta são obrigatórios" 
      });
    }

    console.log("✅ Confirmando draft:", id);
    console.log("📊 Dados:", { categoria, valor, conta, descricao, data });

    const pool = await getPool();

    // Buscar o draft
    const draftResult = await pool
      .request()
      .input("DraftId", sql.Int, parseInt(id))
      .query(`
        SELECT * FROM dbo.Drafts WHERE DraftId = @DraftId
      `);

    if (draftResult.recordset.length === 0) {
      return res.status(404).json({ error: "Draft não encontrado" });
    }

    const draft = draftResult.recordset[0];

    // Inserir na tabela Transactions
    const dataGasto = data || draft.Data || new Date().toISOString().split('T')[0];

    const insertResult = await pool
      .request()
      .input("UserId", sql.NVarChar(100), draft.UserId)
      .input("Valor", sql.Decimal(10, 2), valor)
      .input("Categoria", sql.NVarChar(50), categoria)
      .input("Conta", sql.NVarChar(50), conta)
      .input("Descricao", sql.NVarChar(500), descricao || draft.Merchant || "Sem descrição")
      .input("DataGasto", sql.Date, dataGasto)
      .input("Merchant", sql.NVarChar(200), draft.Merchant)
      .query(`
        INSERT INTO dbo.Transactions 
          (UserId, Valor, Categoria, Conta, Descricao, DataGasto, Merchant, CriadoEm, AtualizadoEm)
        OUTPUT INSERTED.TransactionId
        VALUES 
          (@UserId, @Valor, @Categoria, @Conta, @Descricao, @DataGasto, @Merchant, GETDATE(), GETDATE())
      `);

    const transactionId = insertResult.recordset[0].TransactionId;

    console.log("💾 Transação salva no banco! ID:", transactionId);

    // Deletar o draft
    await pool
      .request()
      .input("DraftId", sql.Int, parseInt(id))
      .query(`DELETE FROM dbo.Drafts WHERE DraftId = @DraftId`);

    console.log("🗑️ Draft deletado:", id);

    // Adicionar XP (gamificação)
    const xpGanho = 10;
    
    await pool
      .request()
      .input("UserId", sql.NVarChar(100), draft.UserId)
      .input("XP", sql.Int, xpGanho)
      .query(`
        UPDATE dbo.Users 
        SET XP = XP + @XP 
        WHERE UserId = @UserId
      `);

    console.log("🎮 XP adicionado:", xpGanho);

    return res.json({
      success: true,
      message: "Transação confirmada com sucesso!",
      transactionId,
      xp_ganho: xpGanho,
      dados: {
        valor,
        categoria,
        conta,
        descricao: descricao || draft.Merchant || "Sem descrição",
        data: dataGasto,
        merchant: draft.Merchant,
      }
    });

  } catch (error: any) {
    console.error("❌ Erro ao confirmar draft:", error);
    console.error("Stack:", error.stack);
    return res.status(500).json({
      error: "Erro ao confirmar draft",
      details: process.env.NODE_ENV === "dev" ? error.message : undefined,
    });
  }
};