import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// ✅ CRÍTICO: Usar process.env.PORT (o Render define como 10000)
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// ROTAS
// ==========================================

// 🏥 Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'GOALS API rodando com sucesso!',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT
  });
});

// 🤖 Parse de Texto com IA
app.post('/ai/parse-text', async (req: Request, res: Response) => {
  try {
    const { texto } = req.body;
    
    if (!texto) {
      return res.status(400).json({ error: 'Texto é obrigatório' });
    }

    // Aqui você chama seu serviço de IA
    // const resultado = await aiService.parseText(texto);
    
    // Resposta mockada para teste
    res.json({
      success: true,
      message: 'Texto processado com sucesso',
      data: {
        valor: 42.90,
        categoria: 'alimentacao',
        merchant: 'Estabelecimento',
        data: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    console.error('Erro ao processar texto:', err);
    res.status(500).json({ 
      error: 'Erro ao processar texto',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// 🎓 Coach Financeiro
app.get('/ai/coach', async (req: Request, res: Response) => {
  try {
    const { userId, period } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    // Aqui você chama seu serviço de IA
    // const analise = await aiService.generateCoaching(userId, period);
    
    // Resposta mockada para teste
    res.json({
      success: true,
      message: 'Análise financeira gerada',
      data: {
        periodo: period || 'week',
        total_gasto: 185.25,
        quantidade_transacoes: 5,
        insights: 'Análise gerada com sucesso!'
      }
    });
  } catch (err) {
    console.error('Erro ao gerar análise:', err);
    res.status(500).json({ 
      error: 'Erro ao gerar análise',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// 💬 Chat com IA
app.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const { pergunta, userId } = req.body;
    
    if (!pergunta) {
      return res.status(400).json({ error: 'Pergunta é obrigatória' });
    }

    // Aqui você chama seu serviço de IA
    // const resposta = await aiService.chat(pergunta, userId);
    
    // Resposta mockada para teste
    res.json({
      success: true,
      pergunta: pergunta,
      resposta: 'Para economizar mais, controle seus gastos diários e evite compras impulsivas!',
      fonte: 'GOALS AI'
    });
  } catch (err) {
    console.error('Erro no chat:', err);
    res.status(500).json({ 
      error: 'Erro ao processar pergunta',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('🎯 GOALS API - Sistema Financeiro IA');
  console.log('========================================');
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${NODE_ENV}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log('========================================');
  console.log('');
});

export default app;
