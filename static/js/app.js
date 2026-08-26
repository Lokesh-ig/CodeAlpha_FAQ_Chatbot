/**
 * NOVABANK FAQ CHATBOT - FRONTEND APPLICATION LOGIC
 */

document.addEventListener('DOMContentLoaded', () => {
    // STATE MANAGEMENT
    const state = {
        currentCategory: 'all',
        categories: [],
        faqs: [],
        isProcessing: false,
        speechSynthesis: window.speechSynthesis || null,
        speechRecognition: null
    };

    // DOM ELEMENTS
    const elements = {
        themeToggle: document.getElementById('theme-toggle'),
        navTabs: document.querySelectorAll('.nav-tab'),
        viewPanels: document.querySelectorAll('.view-panel'),
        
        // Chat View
        chatFeed: document.getElementById('chat-feed'),
        chatForm: document.getElementById('chat-form'),
        userInput: document.getElementById('user-input'),
        typingIndicator: document.getElementById('typing-indicator'),
        quickCatBar: document.getElementById('quick-category-bar'),
        charCounter: document.getElementById('char-counter'),


        
        // KB View
        kbCategoryList: document.getElementById('kb-category-list'),
        kbSearchInput: document.getElementById('kb-search-input'),
        kbSearchClear: document.getElementById('kb-search-clear'),
        kbAccordionList: document.getElementById('kb-accordion-list'),
        kbResultsCount: document.getElementById('kb-results-count'),
        countAll: document.getElementById('count-all'),
        
        // Metrics View
        statTotalFaqs: document.getElementById('stat-total-faqs'),
        statTotalCats: document.getElementById('stat-total-cats'),
        statThreshold: document.getElementById('stat-threshold'),
        statVocabSize: document.getElementById('stat-vocab-size')
    };

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    
    initTheme();
    initNavigation();
    initInputHandler();
    initChatForm();
    initKbSearch();

    
    // Load initial data from Flask API
    loadEngineStats();
    loadCategories();
    loadFaqs();

    // ==========================================================================
    // THEME & NAVIGATION
    // ==========================================================================

    function initTheme() {
        const savedTheme = localStorage.getItem('apex_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeTooltip(savedTheme);

        elements.themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('apex_theme', next);
            updateThemeTooltip(next);
        });
    }

    function updateThemeTooltip(theme) {
        if (theme === 'dark') {
            elements.themeToggle.title = 'Switch to Light Theme';
        } else {
            elements.themeToggle.title = 'Switch to Dark Theme';
        }
    }

    function initNavigation() {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetView = tab.getAttribute('data-view');

                elements.navTabs.forEach(t => t.classList.remove('active'));
                elements.viewPanels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(targetView).classList.add('active');
            });
        });

        // Delegate suggestion chip clicks on welcome screen
        document.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip-btn');
            if (chip && chip.dataset.question) {
                switchTab('chat-view');
                sendQuestion(chip.dataset.question);
            }
        });
    }

    function switchTab(viewId) {
        elements.navTabs.forEach(t => {
            if (t.getAttribute('data-view') === viewId) t.classList.add('active');
            else t.classList.remove('active');
        });

        elements.viewPanels.forEach(p => {
            if (p.id === viewId) p.classList.add('active');
            else p.classList.remove('active');
        });
    }

    // ==========================================================================
    // CHAT & INPUT LOGIC
    // ==========================================================================

    function initInputHandler() {
        const input = elements.userInput;

        // Auto-expand textarea height
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
            elements.charCounter.textContent = `${input.value.length} / 250`;
        });

        // Enter key to send (Shift+Enter for newline)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    function initChatForm() {
        elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = (elements.userInput.value || '').trim();
            if (text && !state.isProcessing) {
                sendQuestion(text);
                elements.userInput.value = '';
                elements.userInput.style.height = 'auto';
                elements.charCounter.textContent = '0 / 250';
            }
        });
    }

    async function sendQuestion(questionText, autoSpeak = false) {
        if (state.isProcessing) return;
        state.isProcessing = true;

        // Render User Message Bubble
        renderUserMessage(questionText);

        // Show Typing Indicator & Scroll
        showTypingIndicator();
        scrollToBottom();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: questionText })
            });

            const data = await response.json();
            hideTypingIndicator();

            if (data.success) {
                renderAssistantMessage(data, autoSpeak);
            } else {
                renderErrorMessage("Sorry, an error occurred while looking up your answer.");
            }
        } catch (err) {
            console.error("Chat error:", err);
            hideTypingIndicator();
            renderErrorMessage("Network connection issue. Please make sure the Flask server is running.");
        } finally {
            state.isProcessing = false;
            scrollToBottom();
        }
    }

    function renderUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg user';
        msgDiv.innerHTML = `
            <div class="msg-avatar">
                <i class="fa-solid fa-user bi bi-person-fill"></i>
            </div>
            <div class="msg-bubble-wrapper">
                <div class="msg-bubble">
                    <div class="msg-text">${escapeHtml(text)}</div>
                </div>
            </div>
        `;
        elements.chatFeed.appendChild(msgDiv);
    }

    function renderAssistantMessage(data, autoSpeak = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg assistant';

        const matchScorePct = (data.similarity_score * 100).toFixed(1);
        const matchClass = (data.match_quality || 'Low').toLowerCase();
        const catIconClass = getCategoryIcon(data.category);

        let suggestionsHtml = '';
        if (data.suggestions && data.suggestions.length > 0) {
            suggestionsHtml = `
                <div class="related-suggestions-box">
                    <p><i class="fa-solid fa-lightbulb bi bi-lightbulb-fill"></i> Related Questions:</p>
                    <div class="related-chips">
                        ${data.suggestions.map(s => `
                            <button class="related-chip" onclick="window.sendRelatedQuestion('${escapeHtml(s.question)}')">
                                ${escapeHtml(s.question)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="msg-avatar">
                <i class="fa-solid fa-robot bi bi-robot"></i>
            </div>
            <div class="msg-bubble-wrapper">
                <div class="msg-bubble">
                    <div class="msg-meta-header">
                        <span class="category-pill"><i class="${catIconClass}"></i> ${escapeHtml(data.category || 'General')}</span>
                        <span class="match-score-badge ${matchClass}" title="TF-IDF Cosine Similarity Score">
                            <i class="fa-solid fa-bullseye bi bi-bullseye"></i> ${matchScorePct}% Match
                        </span>
                    </div>
                    <div class="msg-text">${escapeHtml(data.answer)}</div>
                    
                    ${suggestionsHtml}

                    <div class="msg-actions">
                        <button class="msg-action-btn copy-btn" title="Copy answer text">
                            <i class="fa-solid fa-copy bi bi-clipboard"></i> Copy
                        </button>
                        <button class="msg-action-btn feedback-btn" title="Helpful answer">
                            <i class="fa-solid fa-thumbs-up bi bi-hand-thumbs-up-fill"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        elements.chatFeed.appendChild(msgDiv);

        // Attach action handlers
        const copyBtn = msgDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(data.answer);
            copyBtn.innerHTML = '<i class="fa-solid fa-check bi bi-check-lg"></i> Copied!';
            setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-copy bi bi-clipboard"></i> Copy'; }, 2000);
        });

        const feedbackBtn = msgDiv.querySelector('.feedback-btn');
        feedbackBtn.addEventListener('click', () => {
            feedbackBtn.style.color = '#10b981';
            feedbackBtn.innerHTML = '<i class="fa-solid fa-check bi bi-check-lg"></i> Thanks!';
        });
    }

    function renderErrorMessage(errText) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg assistant';
        msgDiv.innerHTML = `
            <div class="msg-avatar" style="background: var(--badge-low);">
                <i class="fa-solid fa-triangle-exclamation bi bi-exclamation-triangle-fill"></i>
            </div>
            <div class="msg-bubble-wrapper">
                <div class="msg-bubble">
                    <div class="msg-text" style="color: var(--badge-low);">${escapeHtml(errText)}</div>
                </div>
            </div>
        `;
        elements.chatFeed.appendChild(msgDiv);
    }

    // Global helper for related question chips
    window.sendRelatedQuestion = (qText) => {
        sendQuestion(qText);
    };

    function showTypingIndicator() {
        elements.typingIndicator.classList.remove('hidden');
    }

    function hideTypingIndicator() {
        elements.typingIndicator.classList.add('hidden');
    }

    function scrollToBottom() {
        elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
    }


    // ==========================================================================
    // KNOWLEDGE BASE EXPLORER LOGIC
    // ==========================================================================

    async function loadCategories() {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if (data.success) {
                state.categories = data.categories;
                renderCategorySidebar(data.categories);
                renderQuickCategoryBar(data.categories);
            }
        } catch (e) {
            console.error("Failed loading categories:", e);
        }
    }

    function getCategoryIcon(catName) {
        const name = (catName || '').toLowerCase();
        if (name.includes('opening') || name.includes('eligibility')) return 'fa-solid fa-user-plus bi bi-person-plus-fill';
        if (name.includes('login') || name.includes('password') || name.includes('auth')) return 'fa-solid fa-lock bi bi-shield-lock-fill';
        if (name.includes('profile') || name.includes('kyc')) return 'fa-solid fa-address-card bi bi-card-heading';
        if (name.includes('balance') || name.includes('statement')) return 'fa-solid fa-receipt bi bi-receipt-cutoff';
        if (name.includes('transfer') || name.includes('beneficiary')) return 'fa-solid fa-right-left bi bi-arrow-left-right';
        if (name.includes('upi') || name.includes('instant')) return 'fa-solid fa-bolt bi bi-lightning-charge-fill';
        if (name.includes('debit')) return 'fa-solid fa-credit-card bi bi-credit-card-2-front-fill';
        if (name.includes('atm') || name.includes('cash')) return 'fa-solid fa-money-bill-transfer bi bi-cash-coin';
        if (name.includes('credit')) return 'fa-solid fa-credit-card bi bi-credit-card-fill';
        if (name.includes('refund') || name.includes('merchant')) return 'fa-solid fa-bag-shopping bi bi-bag-check-fill';
        if (name.includes('loan') || name.includes('emi')) return 'fa-solid fa-hand-holding-dollar bi bi-bank2';
        if (name.includes('deposit') || name.includes('saving')) return 'fa-solid fa-piggy-bank bi bi-piggy-bank-fill';
        if (name.includes('international') || name.includes('forex')) return 'fa-solid fa-globe bi bi-globe2';
        if (name.includes('security') || name.includes('fraud') || name.includes('privacy')) return 'fa-solid fa-shield-halved bi bi-shield-fill-check';
        if (name.includes('support') || name.includes('complaint') || name.includes('branch')) return 'fa-solid fa-headset bi bi-headset';
        if (name.includes('closure') || name.includes('dormancy')) return 'fa-solid fa-user-slash bi bi-person-x-fill';
        if (name.includes('charge') || name.includes('limit') || name.includes('general')) return 'fa-solid fa-circle-info bi bi-info-circle-fill';
        return 'fa-solid fa-folder bi bi-folder-fill';
    }

    function renderCategorySidebar(categories) {
        let totalCount = 0;
        categories.forEach(c => totalCount += c.count);
        elements.countAll.textContent = totalCount;

        const html = categories.map(cat => `
            <button class="cat-item ${state.currentCategory === cat.name ? 'active' : ''}" data-category="${escapeHtml(cat.name)}">
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="${getCategoryIcon(cat.name)}" style="font-size: 0.85rem; color: var(--accent-primary);"></i>
                    <span>${escapeHtml(cat.name)}</span>
                </span>
                <span class="cat-count">${cat.count}</span>
            </button>
        `).join('');

        elements.kbCategoryList.innerHTML = `
            <button class="cat-item ${state.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-border-all bi bi-grid-fill" style="font-size: 0.85rem; color: var(--accent-primary);"></i>
                    <span>All Topics</span>
                </span>
                <span class="cat-count">${totalCount}</span>
            </button>
            ${html}
        `;

        // Event listener for category selection
        elements.kbCategoryList.querySelectorAll('.cat-item').forEach(btn => {
            btn.addEventListener('click', () => {
                elements.kbCategoryList.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentCategory = btn.dataset.category;
                loadFaqs();
            });
        });
    }

    function renderQuickCategoryBar(categories) {
        const topCats = categories.slice(0, 6);
        elements.quickCatBar.innerHTML = topCats.map(cat => `
            <button type="button" class="cat-pill-btn" onclick="window.filterByCatPill('${escapeHtml(cat.name)}')">
                <i class="${getCategoryIcon(cat.name)}"></i> ${escapeHtml(cat.name)}
            </button>
        `).join('');
    }

    window.filterByCatPill = (catName) => {
        state.currentCategory = catName;
        switchTab('kb-view');
        renderCategorySidebar(state.categories);
        loadFaqs();
    };

    function initKbSearch() {
        let timer = null;
        elements.kbSearchInput.addEventListener('input', () => {
            if (elements.kbSearchInput.value) {
                elements.kbSearchClear.classList.remove('hidden');
            } else {
                elements.kbSearchClear.classList.add('hidden');
            }

            clearTimeout(timer);
            timer = setTimeout(() => {
                loadFaqs();
            }, 300);
        });

        elements.kbSearchClear.addEventListener('click', () => {
            elements.kbSearchInput.value = '';
            elements.kbSearchClear.classList.add('hidden');
            loadFaqs();
        });
    }

    async function loadFaqs() {
        const cat = state.currentCategory;
        const q = elements.kbSearchInput.value.trim();

        let url = `/api/faqs?category=${encodeURIComponent(cat)}`;
        if (q) url += `&q=${encodeURIComponent(q)}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                state.faqs = data.faqs;
                renderFaqAccordion(data.faqs);
                elements.kbResultsCount.textContent = data.total;
            }
        } catch (e) {
            console.error("Failed loading FAQs:", e);
        }
    }

    function renderFaqAccordion(faqs) {
        if (!faqs || faqs.length === 0) {
            elements.kbAccordionList.innerHTML = `
                <div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>No FAQs match your search criteria.</p>
                </div>
            `;
            return;
        }

        elements.kbAccordionList.innerHTML = faqs.map((faq, index) => `
            <div class="kb-item" data-index="${index}">
                <div class="kb-item-header">
                    <div class="kb-item-title">
                        <i class="fa-solid fa-circle-question bi bi-question-circle-fill" style="color: var(--accent-primary);"></i>
                        <span>${escapeHtml(faq.question)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                        <span class="category-pill">${escapeHtml(faq.category || 'General')}</span>
                        <i class="fa-solid fa-chevron-down bi bi-chevron-down toggle-icon" style="color: var(--text-muted); transition: transform 0.2s;"></i>
                    </div>
                </div>
                <div class="kb-item-body">
                    <p>${escapeHtml(faq.answer)}</p>
                    <button class="ask-this-btn" onclick="window.askFaqDirect('${escapeHtml(faq.question)}')">
                        <i class="fa-solid fa-paper-plane bi bi-send-fill"></i> Ask Chatbot about this
                    </button>
                </div>
            </div>
        `).join('');

        // Attach Accordion Toggle logic
        elements.kbAccordionList.querySelectorAll('.kb-item-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.closest('.kb-item');
                item.classList.toggle('open');
            });
        });
    }

    window.askFaqDirect = (questionText) => {
        switchTab('chat-view');
        sendQuestion(questionText);
    };

    // ==========================================================================
    // METRICS LOGIC
    // ==========================================================================

    async function loadEngineStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.success && data.stats) {
                const s = data.stats;
                elements.statTotalFaqs.textContent = s.total_faqs || '170+';
                elements.statTotalCats.textContent = s.total_categories || '14';
                elements.statThreshold.textContent = `${((s.similarity_threshold || 0.4) * 100).toFixed(0)}%`;
                elements.statVocabSize.textContent = s.vectorizer_vocab_size || '--';
            }
        } catch (e) {
            console.error("Failed loading stats:", e);
        }
    }

    // HELPER: Escape HTML strings to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
