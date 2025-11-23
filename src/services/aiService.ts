import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ========================================
// UTILITÁRIOS
// ========================================

function detectarCategoria(texto: string): string | null {
  const textoLower = texto.toLowerCase();
  
  const categorias = {
    alimentacao: ['padaria', 'restaurante', 'lanchonete', 'ifood', 'mcdonalds', "mcdonald's", 'burger', 'pizza', 'bar', 'cafe', 'cafeteria', 'almoço', 'jantar', 'lanche', 'comida'],
    transporte: ['uber', 'taxi', '99', 'gasolina', 'combustível', 'estacionamento', 'metrô', 'ônibus', 'viagem', 'posto'],
    mercado: ['supermercado', 'mercado', 'açougue', 'hortifruti', 'carrefour', 'extra', 'pão de açúcar', 'dia', 'compras'],
    lazer: ['cinema', 'teatro', 'show', 'parque', 'netflix', 'spotify', 'ingresso', 'diversão', 'jogo'],
    saude: ['farmácia', 'drogaria', 'remédio', 'consulta', 'médico', 'dentista', 'exame', 'drogasil', 'pague menos', 'hospital'],
    moradia: ['aluguel', 'condomínio', 'água', 'luz', 'energia', 'gás', 'internet', 'telefone', 'casa'],
    educacao: ['curso', 'faculdade', 'escola', 'livro', 'material', 'apostila', 'mensalidade'],
  };
  
  for (const [categoria, palavras] of Object.entries(categorias)) {
    for (const palavra of palavras) {
      if (textoLower.includes(palavra)) {
        return categoria;
      }
    }
  }
  
  return 'outros';
}

function extrairValorAvancado(texto: string): number | null {
  const textoLower = texto.toLowerCase();
  
  // Padrão 1: R$ 42,90 ou R$ 42.90
  const padraoComVirgula = texto.match(/R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (padraoComVirgula) {
    return parseFloat(padraoComVirgula[1].replace(/\./g, "").replace(",", "."));
  }
  
  // Padrão 2: R$ 42.90 (ponto como decimal)
  const padraoComPonto = texto.match(/R?\$?\s*(\d{1,3}\.\d{2})/);
  if (padraoComPonto) {
    return parseFloat(padraoComPonto[1]);
  }
  
  // Padrão 3: Números por extenso
  const numerosPorExtenso: { [key: string]: number } = {
    'zero': 0, 'um': 1, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14, 'quinze': 15,
    'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19, 'vinte': 20,
    'trinta': 30, 'quarenta': 40, 'cinquenta': 50, 'sessenta': 60,
    'setenta': 70, 'oitenta': 80, 'noventa': 90, 'cem': 100, 'cento': 100,
    'duzentos': 200, 'trezentos': 300, 'quatrocentos': 400, 'quinhentos': 500
  };
  
  let valorTotal = 0;
  let temNumero = false;
  
  for (const [palavra, valor] of Object.entries(numerosPorExtenso)) {
    if (textoLower.includes(palavra)) {
      valorTotal += valor;
      temNumero = true;
    }
  }
  
  // Detectar "e X centavos"
  const centavos = textoLower.match(/e\s+(\w+)\s+centavos?/);
  if (centavos) {
    const centavosPorExtenso: { [key: string]: number } = {
      'dez': 0.10, 'vinte': 0.20, 'trinta': 0.30, 'quarenta': 0.40,
      'cinquenta': 0.50, 'sessenta': 0.60, 'setenta': 0.70,
      'oitenta': 0.80, 'noventa': 0.90, 'cinquenta e cinco': 0.55,
      'trinta e cinco': 0.35
    };
    
    for (const [palavra, valor] of Object.entries(centavosPorExtenso)) {
      if (centavos[1].includes(palavra)) {
        valorTotal += valor;
      }
    }
  }
  
  if (temNumero && valorTotal > 0) {
    return valorTotal;
  }
  
  // Padrão 4: Apenas números inteiros
  const numeroSimples = texto.match(/\b(\d+)\s*(reais?|real)\b/i);
  if (numeroSimples) {
    return parseFloat(numeroSimples[1]);
  }
  
  return null;
}

// ========================================
// FUNÇÃO 1: EXTRAIR DADOS DE TEXTO
// ========================================

export async function extrairDadosComIA(texto: string) {
  try {
    console.log("🤖 Tentando usar Gemini...");
    console.log("📝 Texto:", texto);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
    });

    const prompt = `Você é um extrator de dados financeiros de textos em português do Brasil.

TEXTO PARA ANALISAR:
"""
${texto}
"""

TAREFA: Extraia as informações financeiras e retorne APENAS um JSON válido (sem markdown, sem explicações).

{
  "valor": <número com ponto decimal ou null>,
  "data": "<YYYY-MM-DD ou null>",
  "merchant": "<nome do estabelecimento ou null>",
  "categoria": "<uma categoria ou null>",
  "confidence": <número entre 0 e 1>
}

CATEGORIAS: alimentacao, transporte, mercado, lazer, saude, moradia, educacao, outros

Retorne APENAS o JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log("📥 Resposta do Gemini:", response);
    
    let cleanResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
    
    const dados = JSON.parse(cleanResponse);
    
    console.log("✅ IA FUNCIONOU! Dados extraídos:", dados);
    
    return {
      valor: typeof dados.valor === 'number' ? dados.valor : null,
      data: dados.data && typeof dados.data === 'string' ? dados.data : null,
      merchant: dados.merchant && typeof dados.merchant === 'string' ? dados.merchant : null,
      categoria: dados.categoria && typeof dados.categoria === 'string' ? dados.categoria : null,
      confidence: typeof dados.confidence === 'number' ? Math.min(Math.max(dados.confidence, 0), 1) : 0.5,
    };
    
  } catch (error: any) {
    console.error("❌ Gemini falhou:", error.message);
    console.log("⚠️ Usando SUPER FALLBACK com análise avançada...");
    
    // ✅ EXTRAÇÃO AVANÇADA DE VALOR
    const valor = extrairValorAvancado(texto);

    // Extrair data
    const dataMatch = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const data = dataMatch
      ? `${dataMatch[3]}-${dataMatch[2]}-${dataMatch[1]}`
      : null;

    // Extrair merchant (melhorado)
    let merchant = null;
    const merchantPatterns = [
      /(?:no|na|da|do)\s+([A-ZÇÁÉÍÓÚ][a-zçáéíóúãõâêô]+(?:\s+[A-ZÇÁÉÍÓÚ][a-zçáéíóúãõâêô]+)*)/i,
      /-\s+([A-ZÇÁÉÍÓÚ][a-zçáéíóúãõâêô]+(?:\s+[A-ZÇÁÉÍÓÚ][a-zçáéíóúãõâêô]+)*)\s+-/,
      /\b(Uber|iFood|McDonald'?s?|Padaria\s+\w+|Supermercado\s+\w+|Pão de Açúcar|Extra|Carrefour|Dia|Drogasil|Posto\s+\w+)\b/i,
    ];
    
    for (const pattern of merchantPatterns) {
      const match = texto.match(pattern);
      if (match) {
        merchant = match[1];
        break;
      }
    }

    // Detectar categoria por palavras-chave
    const categoria = detectarCategoria(texto);
    
    // Calcular confiança baseado em quantos dados conseguiu extrair
    let confidence = 0.4; // Base
    if (valor !== null) confidence += 0.2;
    if (merchant !== null) confidence += 0.15;
    if (categoria !== 'outros') confidence += 0.15;
    if (data !== null) confidence += 0.1;
    
    console.log("✅ Super Fallback extraiu:", { valor, data, merchant, categoria, confidence });

    return {
      valor,
      data,
      merchant,
      categoria,
      confidence: Math.min(confidence, 1),
    };
  }
}

// ========================================
// FUNÇÃO 2: COACH FINANCEIRO INTELIGENTE
// ========================================

export async function gerarCoachFinanceiro(dados: {
  totalGasto: number;
  gastosPorCategoria: { categoria: string; total: number }[];
  periodo: string;
  ultimasTransacoes: string[];
}) {
  try {
    console.log("🎓 Tentando gerar análise com Gemini...");
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
    });

    const prompt = `Analise financeira: ${JSON.stringify(dados)}`;
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    let cleanResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
    
    const insights = JSON.parse(cleanResponse);
    console.log("✅ Insights gerados pela IA");
    
    return insights;
    
  } catch (error: any) {
    console.error("❌ Gemini falhou no coach:", error.message);
    console.log("⚠️ Usando ANÁLISE INTELIGENTE baseada em regras...");
    
    // ✅ ANÁLISE INTELIGENTE REAL
    
    const categoriaTop = dados.gastosPorCategoria[0];
    const percentualTop = ((categoriaTop.total / dados.totalGasto) * 100).toFixed(0);
    const qtdCategorias = dados.gastosPorCategoria.length;
    const mediaTransacao = dados.totalGasto / dados.ultimasTransacoes.length;
    
    // Análise geral personalizada
    let analise_geral = "";
    if (dados.totalGasto < 200) {
      analise_geral = `Você gastou R$ ${dados.totalGasto.toFixed(2)} no ${dados.periodo}, mantendo um controle moderado. A categoria ${categoriaTop.categoria} representa ${percentualTop}% do total.`;
    } else if (dados.totalGasto < 500) {
      analise_geral = `No ${dados.periodo}, você gastou R$ ${dados.totalGasto.toFixed(2)}. Seu maior gasto foi em ${categoriaTop.categoria} (${percentualTop}%), com transações distribuídas em ${qtdCategorias} categorias.`;
    } else {
      analise_geral = `Alerta: você gastou R$ ${dados.totalGasto.toFixed(2)} no ${dados.periodo}. A categoria ${categoriaTop.categoria} concentra ${percentualTop}% dos gastos, indicando potencial de economia.`;
    }
    
    // Pontos positivos baseados nos dados
    const pontos_positivos = [];
    if (qtdCategorias >= 3) {
      pontos_positivos.push("Você está diversificando seus gastos em múltiplas categorias");
    }
    if (dados.totalGasto < 500) {
      pontos_positivos.push(`Gastos controlados em ${dados.periodo} - abaixo de R$ 500`);
    }
    if (dados.ultimasTransacoes.length >= 3) {
      pontos_positivos.push("Registrando transações regularmente - essencial para controle");
    }
    if (pontos_positivos.length === 0) {
      pontos_positivos.push("Você está começando a registrar seus gastos");
      pontos_positivos.push("Consciência financeira é o primeiro passo");
    }
    
    // Pontos de atenção personalizados
    const pontos_atencao = [];
    if (parseFloat(percentualTop) > 50) {
      pontos_atencao.push(`${categoriaTop.categoria} representa mais de ${percentualTop}% do total - concentração alta em uma categoria`);
    }
    if (mediaTransacao > 100) {
      pontos_atencao.push(`Média de R$ ${mediaTransacao.toFixed(2)} por transação - considere reduzir valores individuais`);
    }
    if (qtdCategorias < 3) {
      pontos_atencao.push("Poucos registros podem indicar gastos não contabilizados - registre TUDO");
    }
    if (pontos_atencao.length === 0) {
      pontos_atencao.push("Continue registrando todos os gastos para análises mais precisas");
      pontos_atencao.push("Estabeleça limites mensais por categoria");
    }
    
    // Dicas personalizadas
    const dicas = [];
    if (categoriaTop.categoria === 'alimentacao') {
      dicas.push(`Prepare mais refeições em casa - economize até 60% em ${categoriaTop.categoria}`);
      dicas.push(`Limite gastos externos a R$ ${(categoriaTop.total * 0.7).toFixed(2)} no próximo período`);
    } else if (categoriaTop.categoria === 'mercado') {
      dicas.push("Faça lista de compras e siga à risca - evite compras por impulso");
      dicas.push("Compare preços em 2-3 supermercados antes de decidir");
    } else if (categoriaTop.categoria === 'transporte') {
      dicas.push("Avalie caronas solidárias ou transporte público para economizar");
      dicas.push(`Planeje rotas para otimizar deslocamentos e reduzir custos`);
    } else {
      dicas.push(`Defina um teto de R$ ${(categoriaTop.total * 0.85).toFixed(2)} para ${categoriaTop.categoria} no próximo período`);
      dicas.push("Pesquise alternativas mais econômicas antes de cada gasto");
    }
    dicas.push("Revise seus gastos semanalmente e ajuste comportamento");
    
    // Meta baseada nos dados reais
    const metaReducao = (categoriaTop.total * 0.85).toFixed(2);
    const meta_sugerida = `Reduzir gastos com ${categoriaTop.categoria} para R$ ${metaReducao} no próximo ${dados.periodo} (economia de 15%)`;
    
    return {
      analise_geral,
      pontos_positivos: pontos_positivos.slice(0, 2),
      pontos_atencao: pontos_atencao.slice(0, 2),
      dicas: dicas.slice(0, 3),
      meta_sugerida
    };
  }
}

// ========================================
// FUNÇÃO 3: CHAT INTELIGENTE
// ========================================

export async function chatFinanceiroComIA(pergunta: string, contextoUsuario?: {
  totalGasto?: number;
  categoriaPrincipal?: string;
  quantidadeTransacoes?: number;
}) {
  try {
    console.log("💬 Tentando processar com Gemini...");
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
    });

    let contexto = "";
    if (contextoUsuario && contextoUsuario.totalGasto !== undefined) {
      contexto = `\n\nCONTEXTO: Total R$ ${contextoUsuario.totalGasto.toFixed(2)}, Principal: ${contextoUsuario.categoriaPrincipal}`;
    }

    const prompt = `Você é um assistente financeiro. Responda: "${pergunta}"${contexto}`;
    
    const result = await model.generateContent(prompt);
    const resposta = result.response.text();
    
    console.log("✅ Resposta gerada pela IA");
    
    return {
      resposta: resposta.trim(),
      fonte: "Gemini AI",
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error("❌ Gemini falhou no chat:", error.message);
    console.log("⚠️ Usando CHAT INTELIGENTE baseado em padrões...");
    
    // ✅ CHAT INTELIGENTE COM CONTEXTO
    const perguntaLower = pergunta.toLowerCase();
    let resposta = "";
    
    // Personalização com contexto do usuário
    let contextoTexto = "";
    if (contextoUsuario && contextoUsuario.totalGasto) {
      contextoTexto = `\n\nAnalisando seu perfil: você gastou R$ ${contextoUsuario.totalGasto.toFixed(2)} recentemente, com foco em ${contextoUsuario.categoriaPrincipal || 'diversas categorias'}. `;
    }
    
    if (perguntaLower.includes("economizar") || perguntaLower.includes("poupar") || perguntaLower.includes("guardar")) {
      resposta = `Para economizar mais dinheiro:

1. Método 50-30-20: 50% necessidades, 30% desejos, 20% poupança
2. Registre TODOS os gastos no GOALS - você está no caminho certo!
3. Elimine gastos pequenos recorrentes (assinaturas não usadas)
4. Regra das 24 horas: espere 1 dia antes de compras > R$ 100
5. Cozinhe em casa - economiza até 60% em alimentação
6. Use cupons e compare preços sempre${contextoTexto}${contextoUsuario?.categoriaPrincipal ? `Foque em reduzir ${contextoUsuario.categoriaPrincipal} primeiro!` : ''}`;
      
    } else if (perguntaLower.includes("investir") || perguntaLower.includes("aplicar") || perguntaLower.includes("render")) {
      resposta = `Para começar a investir com segurança:

1. PRIMEIRO: Reserve de emergência (6 meses de despesas)
2. Estude: Tesouro Direto, CDB, LCI/LCA (renda fixa)
3. Comece pequeno: R$ 50-100 mensais já fazem diferença
4. Diversifique: não coloque tudo em um lugar
5. Prazo: pense em 5+ anos para melhores resultados
6. Evite: promessas de retorno rápido (geralmente fraude)${contextoTexto}${contextoUsuario?.totalGasto && contextoUsuario.totalGasto > 300 ? `Com seus gastos atuais, tente poupar 10-15% mensalmente.` : ''}`;
      
    } else if (perguntaLower.includes("dívida") || perguntaLower.includes("dever") || perguntaLower.includes("crédito")) {
      resposta = `Para sair das dívidas:

1. Liste TODAS com juros, valores e vencimentos
2. Priorize maiores juros (cartão de crédito primeiro!)
3. Negocie: consegue até 70% desconto
4. Corte gastos não essenciais temporariamente
5. Procure renda extra se possível
6. NÃO faça novas dívidas durante pagamento

Use o GOALS para monitorar seu progresso!${contextoTexto}`;
      
    } else if (perguntaLower.includes("orçamento") || perguntaLower.includes("planejamento") || perguntaLower.includes("planejar")) {
      resposta = `Para criar um orçamento eficaz:

1. Liste TODA a renda mensal (líquida)
2. Categorize gastos: fixos e variáveis
3. Use regra 50-30-20 como base
4. Defina limites por categoria
5. Revise semanalmente e ajuste
6. Use o GOALS para registrar tudo automaticamente

Gastos fixos: aluguel, contas, transporte
Gastos variáveis: alimentação, lazer (aqui você economiza!)${contextoTexto}`;
      
    } else if (perguntaLower.includes("cartão") || perguntaLower.includes("debito")) {
      resposta = `Cartão de crédito vs débito:

CRÉDITO:
✅ Bom para: emergências, acumular pontos
❌ Perigo: juros altíssimos (até 15%/mês!)
💡 Use APENAS se pagar integral

DÉBITO:
✅ Bom para: controle, sem dívidas
✅ Gasta só o que tem
💡 Melhor para quem tem dificuldade em controlar

DICA: Use débito para 90% dos gastos, crédito apenas para compras online/viagens.${contextoTexto}`;
      
    } else if (perguntaLower.includes("emergência") || perguntaLower.includes("reserva")) {
      resposta = `Reserva de emergência - ESSENCIAL:

QUANTO: 6 meses de gastos mensais
ONDE: CDB liquidez diária, Tesouro Selic
QUANDO USAR: Desemprego, doença, emergências reais

EXEMPLO: Gasta R$ 2.000/mês? Reserve R$ 12.000
COMO JUNTAR:
- Comece com R$ 1.000 (meta inicial)
- Aumente 10% por mês
- Nunca use para "oportunidades"${contextoTexto}${contextoUsuario?.totalGasto ? `\nPara seu perfil de gastos, comece poupando R$ ${(contextoUsuario.totalGasto * 0.15).toFixed(2)} por mês.` : ''}`;
      
    } else {
      resposta = `Sobre "${pergunta}":

Dicas gerais de educação financeira:

- Registre 100% dos gastos (use o GOALS!)
- Poupe mínimo 10% da renda
- Evite compras por impulso
- Compare preços sempre
- Invista em conhecimento financeiro
- Tenha metas claras e realistas
- Revise finanças semanalmente${contextoTexto}

Para dicas mais específicas, pergunte sobre: economizar, investir, dívidas, orçamento, cartões ou reserva de emergência!`;
    }
    
    return {
      resposta,
      fonte: "GOALS AI (Análise Inteligente)",
      timestamp: new Date().toISOString()
    };
  }
}