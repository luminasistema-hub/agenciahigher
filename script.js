/* ============================================================
   AGÊNCIA HIGHER — JAVASCRIPT
   Interactions, Animations, Particles, Counter, Form
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- 1. NAVBAR SCROLL ---- */
  const navbar = document.getElementById('nav') || document.getElementById('navbar');
  const scrollHandler = () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });
  scrollHandler();

  /* ---- 2. HAMBURGER MENU ---- */
  const hamburger = document.getElementById('hamburger-btn');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- 3. HERO PARTICLES ---- */
  const particlesContainer = document.getElementById('hero-particles');
  const particleColors = ['#bce769', '#050401', '#FFFAFF', '#d4f28d', '#a3cb5b', '#151413'];
  const PARTICLE_COUNT = 40;

  const createParticle = () => {
    if (!particlesContainer) return;
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const colorIndex = Math.floor(Math.random() * particleColors.length);
    const left = Math.random() * 100;
    const duration = Math.random() * 12 + 8;
    const delay = Math.random() * 10;

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${left}%;
      bottom: -10px;
      background: ${particleColors[colorIndex]};
      box-shadow: 0 0 ${size * 3}px ${particleColors[colorIndex]};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;
    particlesContainer.appendChild(p);
  };

  if (particlesContainer) {
    for (let i = 0; i < PARTICLE_COUNT; i++) createParticle();
  }

  /* ---- 4. SCROLL REVEAL ---- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  const addRevealClasses = () => {
    // Section headers
    document.querySelectorAll('.section-header').forEach(el => {
      el.classList.add('reveal');
      revealObserver.observe(el);
    });

    // Cards with stagger
    const staggerGroups = [
      '.problem-card', '.benefit-card', '.plan-card',
      '.portfolio-card', '.differential-card'
    ];

    staggerGroups.forEach(selector => {
      document.querySelectorAll(selector).forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${i * 0.1}s`;
        revealObserver.observe(el);
      });
    });

    // Other elements
    ['.conclusion-box', '.comparison-table-wrap', '.placeholder-box',
     '.contact-info', '.contact-form-wrap', '.final-cta-content'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
      });
    });
  };

  addRevealClasses();

  /* ---- 5. ANIMATED COUNTER ---- */
  const counters = document.querySelectorAll('.stat-number[data-target]');

  const animateCounter = (el) => {
    const targetString = el.dataset.target;
    const target = parseFloat(targetString);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 2000;
    const start = performance.now();
    
    // Auto-detect decimals
    const decimals = targetString.includes('.') ? targetString.split('.')[1].length : 0;

    const update = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      
      const current = (eased * target).toFixed(decimals);
      el.textContent = `${prefix}${current}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = `${prefix}${targetString}${suffix}`;
      }
    };

    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => counterObserver.observe(c));

  /* ---- 6. CONTACT FORM ---- */
  const form = document.getElementById('contact-form');
  const formSuccess = document.getElementById('form-success');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name    = document.getElementById('contact-name')?.value?.trim() || '';
      const email   = document.getElementById('contact-email')?.value?.trim() || '';
      const phone   = document.getElementById('contact-phone')?.value?.trim() || '';
      const message = document.getElementById('contact-message')?.value?.trim() || '';

      if (!name || !email || !message) {
        showFormError('Por favor, preencha todos os campos obrigatórios (*).');
        return;
      }

      if (!isValidEmail(email)) {
        showFormError('Por favor, insira um e-mail válido.');
        return;
      }

      const submitBtn = document.getElementById('contact-submit-btn');
      submitBtn.textContent = '⏳ Enviando...';
      submitBtn.disabled = true;

      // ── SAVE CONTACT TO SUPABASE ──────────────────────────
      try {
        const { error } = await saveContact({ name, email, phone, message });
        
        if (error) {
          console.error('[Higher] Erro ao salvar contato:', error);
          showFormError('Erro ao enviar mensagem. Por favor, tente novamente mais tarde.');
          submitBtn.textContent = 'ENVIAR MENSAGEM';
          submitBtn.disabled = false;
          return;
        }

        // ── SUCESSO ───────────────────────────────────────────
        form.style.display = 'none';
        if (formSuccess) formSuccess.style.display = 'block';

      } catch (err) {
        console.error('[Higher] Falha na comunicação:', err);
        showFormError('Erro de conexão. Verifique sua internet.');
        submitBtn.textContent = 'ENVIAR MENSAGEM';
        submitBtn.disabled = false;
      }
    });
  }

  function showFormError(msg) {
    let err = document.getElementById('form-error-msg');
    if (!err) {
      err = document.createElement('p');
      err.id = 'form-error-msg';
      err.style.cssText = 'color:#f87171;font-size:0.88rem;margin-top:-0.5rem;margin-bottom:0.75rem;';
      form.insertBefore(err, document.getElementById('contact-submit-btn'));
    }
    err.textContent = msg;
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ---- 7. SMOOTH ACTIVE NAV LINK ---- */
  const sections = document.querySelectorAll('section[id]');
  const navLinksAll = document.querySelectorAll('.nav-link');

  const activeNavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinksAll.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.45 });

  sections.forEach(s => activeNavObserver.observe(s));

  /* ---- 8. FLOATING WHATSAPP — show after scroll ---- */
  const waFloat = document.getElementById('whatsapp-float-btn');
  if (waFloat) {
    waFloat.style.opacity = '0';
    waFloat.style.transform = 'scale(0.5)';
    waFloat.style.transition = 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';

    const showFloat = () => {
      if (window.scrollY > 300) {
        waFloat.style.opacity = '1';
        waFloat.style.transform = 'scale(1)';
      } else {
        waFloat.style.opacity = '0';
        waFloat.style.transform = 'scale(0.5)';
      }
    };
    window.addEventListener('scroll', showFloat, { passive: true });
    showFloat();
  }

  /* ---- 9. PLAN CARDS HOVER GLOW ---- */
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(188, 231, 105, 0.12), #151413 60%)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '';
    });
  });

  /* ---- 10. PORTFOLIO CARD TILT ---- */
  document.querySelectorAll('.portfolio-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-8px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  /* ---- 11. CTA PULSE on idle ---- */
  let idleTimer;
  const primaryCTA = document.getElementById('hero-cta-primary');

  const resetIdle = () => {
    clearTimeout(idleTimer);
    if (primaryCTA) primaryCTA.style.animation = '';
    idleTimer = setTimeout(() => {
      if (primaryCTA) primaryCTA.style.animation = 'btn-pulse 1s ease-in-out 3';
    }, 8000);
  };

  const style = document.createElement('style');
  style.textContent = `
    @keyframes btn-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); box-shadow: 0 15px 50px rgba(188, 231, 105, 0.4); }
    }
    .nav-link.active { color: #fff !important; }
  `;
  document.head.appendChild(style);

/* ============================================================
   CHECKOUT LOGIC
   ============================================================ */

const PLANS = {
  starter: { name: 'Plano Starter', price: 697, recurring: false },
  growth:  { name: 'Plano Growth', price: 1897, recurring: false }, // User said 1897 for second plan
};

function openCheckout(planId) {
  const plan = PLANS[planId];
  if (!plan) return;

  // Reset modal state
  document.getElementById('checkout-form').style.display = 'block';
  document.getElementById('checkout-success').style.display = 'none';
  document.getElementById('checkout-form').reset();

  document.getElementById('checkout-plan-id').value = planId;
  document.getElementById('checkout-plan-name').textContent = plan.name;
  document.getElementById('checkout-plan-price').textContent = `R$ ${plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  
  document.getElementById('modal-checkout').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('modal-checkout').classList.remove('active');
  document.body.style.overflow = '';
}

window.openCheckout = openCheckout;
window.closeCheckout = closeCheckout;


// Handle Qualification Form Submission (Funil de Vendas)
document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const planId = document.getElementById('checkout-plan-id').value;
  const plan = PLANS[planId];
  
  const formData = {
    name:     document.getElementById('chk-name').value.trim(),
    email:    document.getElementById('chk-email').value.trim(),
    whatsapp: document.getElementById('chk-whatsapp').value.trim(),
    document: document.getElementById('chk-doc').value.trim(),
    details:  document.getElementById('chk-details').value.trim()
  };

  const btn = document.getElementById('btn-submit-checkout');
  btn.disabled = true;
  btn.textContent = '⏳ PROCESSANDO...';

  try {
    // 1. SAVE TO LEADS TABLE (Qualification Funnel)
    const db = getSupabase();
    if (!db) throw new Error('Supabase não inicializado.');
    const { error } = await db
      .from('leads')
      .insert([{
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
        document: formData.document,
        project_details: formData.details,
        selected_plan: planId,
        recommended_plan: planId, // Sync with existing column
        status: 'new',
        score: 100 // Manual selection has high score
      }]);

    if (error) throw error;

    // 2. Success! Show message instead of redirecting to payment
    document.getElementById('checkout-form').style.display = 'none';
    document.getElementById('checkout-success').style.display = 'block';

  } catch (err) {
    console.error('[Qualification Error]', err);
    alert('Erro ao processar solicitação: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'SOLICITAR ANÁLISE DO PROJETO';
  }
});
  ['mousemove', 'keydown', 'click', 'scroll'].forEach(ev => {
    document.addEventListener(ev, resetIdle, { passive: true });
  });
  resetIdle();

  console.log('%c🚀 Agência Higher — Site carregado com sucesso!', 'color:#bce769;font-weight:700;font-size:14px;');
});
