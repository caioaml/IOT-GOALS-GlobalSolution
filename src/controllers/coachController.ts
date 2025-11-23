import { Request, Response } from "express";
import sql from "mssql";
import { getPool } from "../config/db";
import { gerarCoachFinanceiro } from "../services/aiService";

// ========================================
// GERAR ANÁLISE FINANCEIRA COM IA
// ========================================
export const gerarAnaliseFinanceira = async (req: Request, res: Response) => {
  try {
    const { userId, period = 'month' } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório" });
    }

    console.log("📊 Gerando análise financeira para:", userId, "período:", period);

    // Definir período em dias
    let dias = 30;
    let periodoNome = "último mês";
    
    switch(period) {
      case 'week':
        dias = 7;
        periodoNome = "última semana";
        break;
      case 'month':
        dias = 30;
        periodoNome = "último mês";
        break;
      case 'quarter':
        dias = 90;
        periodoNome = "últimos 3 meses";
        break;
      case 'year':
        dias = 365;
        periodoNome = "último ano";
        break;
      case 'all':
        dias = 9999;
        periodoNome = "todo o histórico";
        break;
    }

    console.log("🔍 Buscando transações dos últimos", dias, "dias...");

    const pool = await getPool();

    // Buscar transações do período
    const transactions = await pool
      .request()
      .input("UserId", sql.NVarChar(100), userId as string)
      .input("Dias", sql.Int, dias)
      .query(`
        SELECT 
          TransactionId,
          Valor,
          Categoria,
          Merchant,
          Descricao,
          DataGasto,
          CriadoEm
        FROM dbo.Transactions
        WHERE UserId = @UserId
          AND CriadoEm >= DATEADD(DAY, -@Dias, GETDATE())
        ORDER BY CriadoEm DESC
      `);

    console.log("📦 Transações encontradas:", transactions.recordset.length);

    if (transactions.recordset.length === 0) {
      console.log("⚠️ Nenhuma transação encontrada para o período");
      return res.status(404).json({ 
        error: "Nenhuma transação encontrada",
        message: `Nenhuma transação encontrada no período: ${periodoNome}. Confirme alguns drafts primeiro via API POST /drafts/:id/confirm`,
        periodo: periodoNome
      });
    }

    console.log("💰 Calculando totais...");

    // Calcular total gasto
    const totalGasto = transactions.recordset.reduce((sum, t) => sum + parseFloat(t.Valor), 0);
    console.log("💵 Total gasto:", totalGasto);

    // Agrupar por categoria
    const gastosPorCategoria: { [key: string]: number } = {};
    transactions.recordset.forEach(t => {
      const cat = t.Categoria || 'outros';
      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + parseFloat(t.Valor);
    });

    const gastosCategorias = Object.entries(gastosPorCategoria)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);

    console.log("📊 Categorias:", gastosCategorias);

    // Últimas 10 transações como texto
    const ultimasTransacoes = transactions.recordset.slice(0, 10).map(t => 
      `R$ ${parseFloat(t.Valor).toFixed(2)} - ${t.Categoria || 'outros'} - ${t.Merchant || t.Descricao || 'sem descrição'}`
    );

    console.log("🤖 Chamando IA para gerar insights...");

    // Chamar IA para gerar insights
    const insights = await gerarCoachFinanceiro({
      totalGasto,
      gastosPorCategoria: gastosCategorias,
      periodo: periodoNome,
      ultimasTransacoes,
    });

    console.log("✅ Insights gerados com sucesso!");

    return res.json({
      periodo: periodoNome,
      dias_analisados: dias === 9999 ? transactions.recordset.length : dias,
      total_gasto: totalGasto,
      gastos_por_categoria: gastosCategorias,
      quantidade_transacoes: transactions.recordset.length,
      insights,
      ai_powered: true,
    });

  } catch (error: any) {
    console.error("❌ Erro ao gerar análise:");
    console.error("   Mensagem:", error.message);
    console.error("   Stack:", error.stack);
    return res.status(500).json({
      error: "Erro ao gerar análise",
      details: error.message,
      stack: process.env.NODE_ENV === "dev" ? error.stack : undefined,
    });
  }
};