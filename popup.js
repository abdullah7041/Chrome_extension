class DigitalGuideUI {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.aiToggle = document.getElementById('aiToggle');
        this.toggleSwitch = document.getElementById('toggleSwitch');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.tokenSetup = document.getElementById('tokenSetup');
        this.tokenInput = document.getElementById('tokenInput');
        this.saveTokenBtn = document.getElementById('saveTokenBtn');
        this.aiStatus = document.getElementById('aiStatus');
        this.aiIndicator = document.getElementById('aiIndicator');
        this.aiStatusText = document.getElementById('aiStatusText');
        
        this.isSearching = false;
        this.aiEnabled = true;
        this.hasToken = false;
        
        this.init();
    }
    
    init() {
        this.createParticles();
        this.bindEvents();
        this.checkAIStatus();
        this.loadSettings();
        
        // Auto-focus search input
        setTimeout(() => this.searchInput.focus(), 300);
    }
    
    createParticles() {
        const particlesContainer = document.getElementById('aiParticles');
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 3 + 's';
            particle.style.animationDuration = (Math.random() * 2 + 2) + 's';
            particlesContainer.appendChild(particle);
        }
    }
    
    bindEvents() {
        // Search functionality
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        
        // Real-time search suggestions
        this.searchInput.addEventListener('input', (e) => {
            if (e.target.value.length > 2) {
                this.debounce(() => this.showSuggestions(e.target.value), 300);
            }
        });
        
        // AI toggle
        this.toggleSwitch.addEventListener('click', () => this.toggleAI());
        
        // Settings
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.saveTokenBtn.addEventListener('click', () => this.saveToken());
        
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const searchTerm = btn.getAttribute('data-search');
                this.searchInput.value = searchTerm;
                this.handleSearch();
            });
        });
        
        // Token input validation
        this.tokenInput.addEventListener('input', (e) => {
            const token = e.target.value.trim();
            this.saveTokenBtn.disabled = !token || token.length < 20;
        });
    }
    
    async checkAIStatus() {
        try {
            const result = await chrome.storage.local.get(['huggingface_token']);
            this.hasToken = !!result.huggingface_token;
            this.updateAIStatus();
        } catch (error) {
            console.error('Error checking AI status:', error);
            this.hasToken = false;
            this.updateAIStatus();
        }
    }
    
    updateAIStatus() {
        if (this.hasToken && this.aiEnabled) {
            this.aiIndicator.classList.remove('offline');
            this.aiStatusText.textContent = 'الذكاء الاصطناعي نشط';
        } else if (!this.hasToken) {
            this.aiIndicator.classList.add('offline');
            this.aiStatusText.textContent = 'يتطلب إعداد الذكاء الاصطناعي';
        } else {
            this.aiIndicator.classList.add('offline');
            this.aiStatusText.textContent = 'الذكاء الاصطناعي معطل';
        }
    }
    
    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        this.toggleSwitch.classList.toggle('active', this.aiEnabled);
        this.updateAIStatus();
        this.saveSettings();
    }
    
    toggleSettings() {
        const isVisible = this.tokenSetup.classList.contains('show');
        this.tokenSetup.classList.toggle('show', !isVisible);
    }
    
    async saveToken() {
        const token = this.tokenInput.value.trim();
        if (!token) return;
        
        try {
            this.saveTokenBtn.textContent = 'جاري الحفظ...';
            this.saveTokenBtn.disabled = true;
            
            // Test the token
            const isValid = await this.testHuggingFaceToken(token);
            if (!isValid) {
                throw new Error('مفتاح API غير صحيح');
            }
            
            await chrome.storage.local.set({ huggingface_token: token });
            this.hasToken = true;
            this.updateAIStatus();
            
            this.saveTokenBtn.textContent = 'تم الحفظ ✓';
            setTimeout(() => {
                this.toggleSettings();
                this.saveTokenBtn.textContent = 'حفظ المفتاح';
            }, 1500);
            
        } catch (error) {
            console.error('Token save error:', error);
            this.saveTokenBtn.textContent = 'خطأ في المفتاح';
            setTimeout(() => {
                this.saveTokenBtn.textContent = 'حفظ المفتاح';
                this.saveTokenBtn.disabled = false;
            }, 2000);
        }
    }
    
    async testHuggingFaceToken(token) {
        try {
            const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: 'test' })
            });
            return response.ok || response.status === 503; // 503 means model loading
        } catch (error) {
            return false;
        }
    }
    
    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query || this.isSearching) return;
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            const currentTab = await this.getCurrentTab();
            const context = {
                currentSite: this.extractDomain(currentTab?.url),
                aiEnabled: this.aiEnabled && this.hasToken
            };
            
            const response = await chrome.runtime.sendMessage({
                action: 'ai_search',
                query: query,
                context: context
            });
            
            if (response.success) {
                this.displayResults(response.results, query);
            } else {
                throw new Error(response.error || 'حدث خطأ في البحث');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
        } finally {
            this.isSearching = false;
        }
    }
    
    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab;
        } catch (error) {
            return null;
        }
    }
    
    extractDomain(url) {
        if (!url) return null;
        try {
            const domain = new URL(url).hostname;
            return domain.endsWith('.gov.sa') ? domain : null;
        } catch {
            return null;
        }
    }
    
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">🧠 الذكاء الاصطناعي يبحث لك...</div>
            </div>
        `;
    }
    
    displayResults(data, query) {
        if (!data || (!data.results?.length && !data.aiAnswer)) {
            this.showNoResults(query);
            return;
        }
        
        let html = '';
        
        // AI Answer Section
        if (data.aiAnswer && this.aiEnabled) {
            html += `
                <div class="ai-answer">
                    <div class="ai-answer-text">${this.escapeHtml(data.aiAnswer)}</div>
                    ${data.confidence ? `
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${data.confidence}%"></div>
                        </div>
                        <div class="confidence-text">دقة الإجابة: ${data.confidence}%</div>
                    ` : ''}
                </div>
            `;
        }
        
        // Search Results
        if (data.results?.length) {
            data.results.forEach(result => {
                const isOfficial = result.type === 'official_service';
                const isAI = result.source === 'semantic_ai';
                
                html += `
                    <div class="result-item ${isOfficial ? 'official' : ''} ${isAI ? 'ai-enhanced' : ''}">
                        <div class="result-title">
                            ${this.escapeHtml(result.title)}
                            ${isOfficial ? '<span class="result-badge">رسمي</span>' : ''}
                            ${isAI ? '<span class="result-badge">ذكي</span>' : ''}
                        </div>
                        <div class="result-snippet">${this.escapeHtml(result.snippet)}</div>
                        <div class="result-meta">
                            <a href="${result.url}" class="result-link" target="_blank">زيارة الرابط</a>
                            ${result.confidence ? `<span>الثقة: ${Math.round(result.confidence * 100)}%</span>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        this.resultsContainer.innerHTML = html;
        
        // Add click tracking
        this.trackResultClicks();
    }
    
    showNoResults(query) {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <p>لم أجد نتائج مناسبة لـ "${this.escapeHtml(query)}"</p>
                <p style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
                    جرب استخدام كلمات مختلفة أو تأكد من تفعيل الذكاء الاصطناعي
                </p>
            </div>
        `;
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <p>${message}</p>
            </div>
        `;
    }
    
    showSuggestions(query) {
        // Real-time suggestions based on query
        const suggestions = this.generateSuggestions(query);
        if (suggestions.length > 0) {
            // Could show dropdown with suggestions
            console.log('Suggestions:', suggestions);
        }
    }
    
    generateSuggestions(query) {
        const commonQueries = [
            'رخصة عمل',
            'تأمينات اجتماعية',
            'وزارة العدل',
            'أبشر',
            'نظام العمل',
            'وزارة المالية',
            'كيف أحصل على',
            'ما هي الإجراءات',
            'المستندات المطلوبة'
        ];
        
        return commonQueries.filter(suggestion => 
            suggestion.includes(query) || 
            query.includes(suggestion.substring(0, 2))
        );
    }
    
    trackResultClicks() {
        document.querySelectorAll('.result-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Track analytics
                console.log('Result clicked:', e.target.href);
            });
        });
    }
    
    saveSettings() {
        chrome.storage.local.set({
            ai_enabled: this.aiEnabled
        });
    }
    
    loadSettings() {
        chrome.storage.local.get(['ai_enabled'], (result) => {
            if (result.ai_enabled !== undefined) {
                this.aiEnabled = result.ai_enabled;
                this.toggleSwitch.classList.toggle('active', this.aiEnabled);
                this.updateAIStatus();
            }
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DigitalGuideUI();
});

// Add some dynamic effects
document.addEventListener('mousemove', (e) => {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((particle, index) => {
        const speed = (index % 3 + 1) * 0.01;
        const x = (e.clientX * speed) % window.innerWidth;
        const y = (e.clientY * speed) % window.innerHeight;
        
        particle.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
    });
});