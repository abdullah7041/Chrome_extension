class DigitalGuideContentAssistant {
    constructor() {
        this.isInjected = false;
        this.widget = null;
        this.isGovSite = this.checkIfGovSite();
        this.pageContent = '';
        this.siteStructure = null;
        
        if (this.isGovSite) {
            this.init();
        }
    }
    
    checkIfGovSite() {
        return window.location.hostname.endsWith('.gov.sa');
    }
    
    init() {
        // Wait for page to fully load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        this.extractPageContent();
        this.analyzeSiteStructure();
        this.injectSmartWidget();
        this.setupPageAnalysis();
        this.isInjected = true;
    }
    
    extractPageContent() {
        // Extract meaningful content from the government page
        const contentSelectors = [
            'main',
            '.content',
            '.page-content',
            'article',
            '.services',
            '.procedures',
            '.requirements'
        ];
        
        let extractedContent = '';
        
        // Try specific selectors first
        for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                extractedContent += this.cleanText(el.textContent) + '\n';
            });
        }
        
        // Fallback to body content if nothing found
        if (!extractedContent.trim()) {
            extractedContent = this.cleanText(document.body.textContent);
        }
        
        this.pageContent = extractedContent.substring(0, 5000); // Limit for API
    }
    
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
    }
    
    analyzeSiteStructure() {
        const domain = window.location.hostname;
        const path = window.location.pathname;
        
        this.siteStructure = {
            domain,
            path,
            title: document.title,
            language: document.documentElement.lang || 'ar',
            services: this.extractServiceLinks(),
            navigation: this.extractNavigation(),
            forms: this.extractForms()
        };
    }
    
    extractServiceLinks() {
        const serviceLinks = [];
        const linkSelectors = [
            'a[href*="service"]',
            'a[href*="خدمة"]',
            'a[href*="procedure"]',
            'a[href*="إجراء"]',
            '.service-link',
            '.procedure-link'
        ];
        
        linkSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                if (link.href && link.textContent.trim()) {
                    serviceLinks.push({
                        text: link.textContent.trim(),
                        href: link.href,
                        description: link.getAttribute('title') || ''
                    });
                }
            });
        });
        
        return serviceLinks.slice(0, 20); // Limit results
    }
    
    extractNavigation() {
        const navItems = [];
        const navSelectors = ['nav', '.navigation', '.menu', '.navbar'];
        
        navSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(nav => {
                nav.querySelectorAll('a').forEach(link => {
                    if (link.href && link.textContent.trim()) {
                        navItems.push({
                            text: link.textContent.trim(),
                            href: link.href
                        });
                    }
                });
            });
        });
        
        return navItems.slice(0, 15);
    }
    
    extractForms() {
        const forms = [];
        document.querySelectorAll('form').forEach(form => {
            const formData = {
                action: form.action || window.location.href,
                method: form.method || 'GET',
                fields: []
            };
            
            form.querySelectorAll('input, select, textarea').forEach(field => {
                if (field.name || field.id) {
                    formData.fields.push({
                        name: field.name || field.id,
                        type: field.type || field.tagName.toLowerCase(),
                        label: this.getFieldLabel(field),
                        required: field.required
                    });
                }
            });
            
            if (formData.fields.length > 0) {
                forms.push(formData);
            }
        });
        
        return forms;
    }
    
    getFieldLabel(field) {
        // Try to find associated label
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent.trim();
        
        // Look for nearby text
        const parent = field.parentElement;
        if (parent) {
            const text = parent.textContent.replace(field.value || '', '').trim();
            if (text && text.length < 100) return text;
        }
        
        return field.placeholder || field.name || '';
    }
    
    injectSmartWidget() {
        this.widget = document.createElement('div');
        this.widget.id = 'digital-guide-widget';
        this.widget.innerHTML = this.createWidgetHTML();
        document.body.appendChild(this.widget);
        
        this.bindWidgetEvents();
        this.animateWidgetEntrance();
    }
    
    createWidgetHTML() {
        return `
            <div class="dg-widget-container">
                <div class="dg-widget-header">
                    <div class="dg-widget-title">
                        <span class="dg-icon">🤖</span>
                        <span>دليلي الرقمي</span>
                    </div>
                    <div class="dg-widget-controls">
                        <button class="dg-minimize-btn" title="تصغير">−</button>
                        <button class="dg-close-btn" title="إغلاق">×</button>
                    </div>
                </div>
                <div class="dg-widget-content">
                    <div class="dg-page-analysis" id="dgPageAnalysis">
                        <div class="dg-analysis-header">
                            <span class="dg-analysis-icon">📊</span>
                            <span>تحليل الصفحة</span>
                        </div>
                        <div class="dg-analysis-content" id="dgAnalysisContent">
                            <div class="dg-loading">جاري تحليل الصفحة...</div>
                        </div>
                    </div>
                    
                    <div class="dg-quick-search">
                        <div class="dg-search-box">
                            <input type="text" id="dgQuickSearch" placeholder="اسأل عن هذه الصفحة...">
                            <button id="dgQuickSearchBtn">🔍</button>
                        </div>
                    </div>
                    
                    <div class="dg-suggestions" id="dgSuggestions">
                        <div class="dg-suggestions-header">💡 اقتراحات ذكية</div>
                        <div class="dg-suggestions-content" id="dgSuggestionsContent"></div>
                    </div>
                    
                    <div class="dg-page-shortcuts" id="dgPageShortcuts">
                        <div class="dg-shortcuts-header">🔗 روابط سريعة</div>
                        <div class="dg-shortcuts-content" id="dgShortcutsContent"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindWidgetEvents() {
        // Widget controls
        const minimizeBtn = this.widget.querySelector('.dg-minimize-btn');
        const closeBtn = this.widget.querySelector('.dg-close-btn');
        const content = this.widget.querySelector('.dg-widget-content');
        const header = this.widget.querySelector('.dg-widget-header');
        
        minimizeBtn.addEventListener('click', () => {
            const isMinimized = content.style.display === 'none';
            content.style.display = isMinimized ? 'block' : 'none';
            minimizeBtn.textContent = isMinimized ? '−' : '+';
        });
        
        closeBtn.addEventListener('click', () => {
            this.widget.style.display = 'none';
        });
        
        // Make draggable
        this.makeDraggable(header);
        
        // Search functionality
        const searchInput = document.getElementById('dgQuickSearch');
        const searchBtn = document.getElementById('dgQuickSearchBtn');
        
        searchBtn.addEventListener('click', () => this.performQuickSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performQuickSearch();
        });
        
        // Auto-complete suggestions
        searchInput.addEventListener('input', (e) => {
            if (e.target.value.length > 2) {
                this.debounce(() => this.showAutoComplete(e.target.value), 300);
            }
        });
    }
    
    makeDraggable(element) {
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;
        
        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.dg-widget-controls')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            element.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                this.widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'grab';
        });
    }
    
    animateWidgetEntrance() {
        this.widget.style.opacity = '0';
        this.widget.style.transform = 'translateX(100px) scale(0.9)';
        
        setTimeout(() => {
            this.widget.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            this.widget.style.opacity = '1';
            this.widget.style.transform = 'translateX(0) scale(1)';
        }, 500);
    }
    
    setupPageAnalysis() {
        setTimeout(() => {
            this.analyzePageWithAI();
            this.generateSmartSuggestions();
            this.populatePageShortcuts();
        }, 1000);
    }
    
    async analyzePageWithAI() {
        try {
            const analysisContent = document.getElementById('dgAnalysisContent');
            
            // Send page content to background for AI analysis
            const response = await chrome.runtime.sendMessage({
                action: 'get_ai_answer',
                question: 'قم بتحليل هذه الصفحة الحكومية وأخبرني بأهم الخدمات والمعلومات المتاحة',
                context: {
                    pageContent: this.pageContent,
                    siteStructure: this.siteStructure,
                    results: []
                }
            });
            
            if (response.success && response.answer) {
                analysisContent.innerHTML = `
                    <div class="dg-analysis-result">
                        <div class="dg-analysis-text">${this.escapeHtml(response.answer)}</div>
                        <div class="dg-analysis-meta">
                            <span class="dg-page-type">${this.getPageType()}</span>
                            <span class="dg-content-score">المحتوى: ${this.calculateContentScore()}/10</span>
                        </div>
                    </div>
                `;
            } else {
                this.showFallbackAnalysis(analysisContent);
            }
        } catch (error) {
            console.error('Page analysis error:', error);
            this.showFallbackAnalysis(document.getElementById('dgAnalysisContent'));
        }
    }
    
    showFallbackAnalysis(container) {
        const pageType = this.getPageType();
        const serviceCount = this.siteStructure.services.length;
        const formCount = this.siteStructure.forms.length;
        
        container.innerHTML = `
            <div class="dg-analysis-result">
                <div class="dg-analysis-text">
                    هذه ${pageType} تحتوي على ${serviceCount} خدمة${serviceCount > 0 ? ' و' : ''}${formCount} نموذج.
                    ${this.generatePageInsights()}
                </div>
                <div class="dg-analysis-meta">
                    <span class="dg-page-type">${pageType}</span>
                    <span class="dg-content-score">المحتوى: ${this.calculateContentScore()}/10</span>
                </div>
            </div>
        `;
    }
    
    getPageType() {
        const path = window.location.pathname.toLowerCase();
        const title = document.title.toLowerCase();
        
        if (path.includes('service') || path.includes('خدمة')) return 'صفحة خدمة';
        if (path.includes('form') || path.includes('نموذج')) return 'صفحة نموذج';
        if (path.includes('procedure') || path.includes('إجراء')) return 'صفحة إجراءات';
        if (path.includes('law') || path.includes('نظام')) return 'صفحة أنظمة';
        if (title.includes('الرئيسية') || path === '/') return 'الصفحة الرئيسية';
        
        return 'صفحة حكومية';
    }
    
    calculateContentScore() {
        let score = 5; // Base score
        
        // Add points for content richness
        if (this.pageContent.length > 1000) score += 1;
        if (this.siteStructure.services.length > 0) score += 2;
        if (this.siteStructure.forms.length > 0) score += 1;
        if (this.siteStructure.navigation.length > 5) score += 1;
        
        return Math.min(score, 10);
    }
    
    generatePageInsights() {
        const insights = [];
        
        if (this.siteStructure.forms.length > 0) {
            insights.push('يمكنك ملء النماذج الإلكترونية مباشرة');
        }
        
        if (this.siteStructure.services.length > 3) {
            insights.push('تتوفر خدمات متعددة في هذه الصفحة');
        }
        
        if (this.pageContent.includes('مطلوب') || this.pageContent.includes('شرط')) {
            insights.push('تحقق من المتطلبات قبل التقديم');
        }
        
        return insights.length > 0 ? ' ' + insights.join('. ') + '.' : '';
    }
    
    generateSmartSuggestions() {
        const suggestions = [];
        const pageType = this.getPageType();
        
        // Context-aware suggestions
        if (pageType === 'صفحة خدمة') {
            suggestions.push('كيف أتقدم لهذه الخدمة؟');
            suggestions.push('ما هي المستندات المطلوبة؟');
            suggestions.push('كم يستغرق الإنجاز؟');
        } else if (pageType === 'صفحة نموذج') {
            suggestions.push('كيف أملأ هذا النموذج؟');
            suggestions.push('أين أرسل النموذج بعد ملئه؟');
        } else if (pageType === 'الصفحة الرئيسية') {
            suggestions.push('ما أهم الخدمات المتاحة؟');
            suggestions.push('كيف أتواصل مع الوزارة؟');
        }
        
        // Add common questions
        suggestions.push('ما هي ساعات العمل؟');
        suggestions.push('هل يمكنني إنجاز هذا إلكترونياً؟');
        
        this.displaySuggestions(suggestions);
    }
    
    displaySuggestions(suggestions) {
        const container = document.getElementById('dgSuggestionsContent');
        const suggestionsHTML = suggestions.map(suggestion => `
            <div class="dg-suggestion-item" data-suggestion="${suggestion}">
                <span class="dg-suggestion-icon">❓</span>
                <span class="dg-suggestion-text">${suggestion}</span>
            </div>
        `).join('');
        
        container.innerHTML = suggestionsHTML;
        
        // Add click handlers
        container.querySelectorAll('.dg-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const suggestion = item.dataset.suggestion;
                document.getElementById('dgQuickSearch').value = suggestion;
                this.performQuickSearch();
            });
        });
    }
    
    populatePageShortcuts() {
        const shortcuts = this.siteStructure.services.slice(0, 5);
        const container = document.getElementById('dgShortcutsContent');
        
        if (shortcuts.length === 0) {
            container.innerHTML = '<div class="dg-no-shortcuts">لا توجد روابط سريعة متاحة</div>';
            return;
        }
        
        const shortcutsHTML = shortcuts.map(shortcut => `
            <a href="${shortcut.href}" class="dg-shortcut-item" title="${shortcut.description}">
                <span class="dg-shortcut-icon">🔗</span>
                <span class="dg-shortcut-text">${shortcut.text}</span>
            </a>
        `).join('');
        
        container.innerHTML = shortcutsHTML;
    }
    
    async performQuickSearch() {
        const query = document.getElementById('dgQuickSearch').value.trim();
        if (!query) return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'get_ai_answer',
                question: query,
                context: {
                    pageContent: this.pageContent,
                    siteStructure: this.siteStructure,
                    currentUrl: window.location.href,
                    results: [{ 
                        title: document.title, 
                        snippet: this.pageContent.substring(0, 200),
                        url: window.location.href 
                    }]
                }
            });
            
            if (response.success) {
                this.showSearchResult(response.answer, query);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Quick search error:', error);
            this.showSearchResult('عذراً، لم أتمكن من الإجابة على هذا السؤال. جرب سؤالاً آخر.', query);
        }
    }
    
    showSearchResult(answer, query) {
        // Create or update result modal
        let modal = document.getElementById('dgResultModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dgResultModal';
            modal.className = 'dg-result-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="dg-modal-content">
                <div class="dg-modal-header">
                    <h3>إجابة ذكية</h3>
                    <button class="dg-modal-close">×</button>
                </div>
                <div class="dg-modal-body">
                    <div class="dg-query">السؤال: ${this.escapeHtml(query)}</div>
                    <div class="dg-answer">${this.escapeHtml(answer)}</div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Close functionality
        modal.querySelector('.dg-modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    showAutoComplete(query) {
        // Show intelligent auto-complete suggestions
        const suggestions = this.generateAutoComplete(query);
        
        // Implementation would show dropdown with suggestions
        console.log('Auto-complete suggestions:', suggestions);
    }
    
    generateAutoComplete(query) {
        const contextSuggestions = [];
        
        // Extract relevant terms from page content
        const words = this.pageContent.split(/\s+/);
        const relevantWords = words.filter(word => 
            word.length > 3 && 
            word.includes(query.substring(0, 2))
        );
        
        return relevantWords.slice(0, 5);
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

// Initialize the content assistant
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DigitalGuideContentAssistant());
} else {
    new DigitalGuideContentAssistant();
}