/**
 * HIGHER CRM — AI LEAD SCORING ENGINE
 */
export const AI_SCORER = {
  analyze(lead) {
    let score = 0;
    const reasons = [];

    // 1. Cargo/Autoridade
    const highAuthority = ['ceo', 'dono', 'diretor', 'socio', 'gerente', 'proprietário'];
    if (lead.name && highAuthority.some(word => lead.name.toLowerCase().includes(word))) {
      score += 25;
      reasons.push('Alta autoridade');
    }

    // 2. Canal de Contato
    if (lead.whatsapp) score += 15; // Lead com Whats é mais propenso a converter

    // 3. Análise da Empresa (Business Name)
    if (lead.business_name && lead.business_name.length > 5) {
      score += 20;
      reasons.push('Empresa identificada');
    }

    // 4. Intenção na Mensagem (Simulação de NLP)
    const keywordsHot = ['urgente', 'agora', 'orçamento', 'preço', 'projeto', 'fechar', 'investimento'];
    const keywordsWarm = ['conhecer', 'dúvida', 'aprender', 'informação', 'olá'];
    
    const obs = (lead.notes || '').toLowerCase();
    
    if (keywordsHot.some(k => obs.includes(k))) {
      score += 35;
      reasons.push('Alta intenção de compra');
    } else if (keywordsWarm.some(k => obs.includes(k))) {
      score += 15;
      reasons.push('Interesse inicial');
    }

    // Limitar score
    score = Math.min(100, score);

    // Definir temperatura
    let temperature = 'cold';
    if (score >= 75) temperature = 'hot';
    else if (score >= 40) temperature = 'warm';

    return {
      score,
      temperature,
      summary: reasons.length ? `Análise IA: ${reasons.join(', ')}.` : 'Lead frio, pouca informação disponível.'
    };
  }
};
