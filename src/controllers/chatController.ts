import { Request, Response } from "express";
import sql from "mssql";
import { getPool } from "../config/db";
import { chatFinanceiroComIA } from "../services/aiService";

// ========================================
// CHAT COM IA FINANCEIRA
// ========================================
export const chatComIA = async (req: Request, res: Response) => {
  try {
    const { userId, pergunta } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório" });
    }

    if (!pergunta || pergunta.trim().length === 0) {
      return res.status(400).json({ error: "pergunta é obrigatória" });
    }

    console.log("💬 Chat IA - User:", userId, "Pergunta:", pergunta);

    // Buscar contexto do usuário (últimas transações)
    const pool = await getPool();
    const transactions = await pool
      .request()
      .input("UserId", sql.NVarChar(100), userId as string)
      .query(`
        SELECT TOP 50
          Valor,
          Categoria,
          CriadoEm
        FROM dbo.Transactions
        WHERE UserId = @UserId
          AND CriadoEm >= DATEADD(MONTH, -1, GETDATE())
        ORDER BY CriadoEm DESC
      `);

    // Montar contexto opcional
    let contextoUsuario = undefined;
    
    if (transactions.recordset.length > 0) {
      const totalGasto = transactions.recordset.reduce((sum, t) => sum + t.Valor, 0);
      
      const gastosPorCategoria: { [key: string]: number } = {};
      transactions.recordset.forEach(t => {
        const cat = t.Categoria || 'outros';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + t.Valor;
      });

      const categoriaPrincipal = Object.entries(gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      contextoUsuario = {
        totalGasto,
        categoriaPrincipal,
        quantidadeTransacoes: transactions.recordset.length
      };
    }

    // Chamar IA
    const resultado = await chatFinanceiroComIA(pergunta, contextoUsuario);

    return res.json({
      pergunta,
      resposta: resultado.resposta,
      fonte: resultado.fonte,
      timestamp: resultado.timestamp,
      contexto_usado: !!contextoUsuario
    });

  } catch (error: any) {
    console.error("❌ Erro no chat:", error);
    return res.status(500).json({
      error: "Erro ao processar pergunta",
      details: process.env.NODE_ENV === "dev" ? error.message : undefined,
    });
  }
};