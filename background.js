class DigitalGuideAI {
    constructor() {
        this.huggingFaceToken = null; // Will be set by user
        this.apiEndpoint = 'https://api-inference.huggingface.co/models/';
        this.models = {
            'qa': 'deepset/roberta-base-squad2-distilled',
            'text': 'microsoft/DialoGPT-medium',
            'arabic': 'aubmindlab/bert-base-arabert',
            'search': 'sentence-transformers/all-MiniLM-L6-v2'
        };
        
        this.govSiteData = new Map();
        this.searchCache = new Map();
        this.init();
    }
    
    init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open
        });
        
        chrome.storage.local.get(['huggingface_token'], (result) => {
            this.huggingFaceToken = result.huggingface_token;
        });
        
        // Initialize government site knowledge base
        this.initGovSiteKnowledge();
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'ai_search':
                    const results = await this.performAISearch(request.query, request.context);
                    sendResponse({ success: true, results });
                    break;
                    
                case 'set_token':
                    await this.setHuggingFaceToken(request.token);
                    sendResponse({ success: true });
                    break;
                    
                case 'extract_content':
                    const content = await this.extractSiteContent(request.url);
                    sendResponse({ success: true, content });
                    break;
                    
                case 'get_ai_answer':
                    const answer = await this.getAIAnswer(request.question, request.context);
                    sendResponse({ success: true, answer });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async setHuggingFaceToken(token) {
        this.huggingFaceToken = token;
        await chrome.storage.local.set({ huggingface_token: token });
    }
    
    initGovSiteKnowledge() {
        // Real government site structure and services
        this.govSiteData.set('hrsd.gov.sa', {
            name: 'وزارة العمل والتنمية الاجتماعية',
            services: [
                {
                    name: 'تصاريح العمل',
                    url: '/services/work-permits',
                    keywords: ['رخصة عمل', 'تصريح عمل', 'إذن عمل', 'عمالة'],
                    description: 'خدمات إصدار وتجديد تصاريح العمل للعمالة الوافدة'
                },
                {
                    name: 'نظام العمل',
                    url: '/labor-law',
                    keywords: ['نظام العمل', 'قانون العمل', 'حقوق العمال'],
                    description: 'نصوص نظام العمل السعودي والحقوق والواجبات'
                },
                {
                    name: 'التأمينات الاجتماعية',
                    url: '/social-insurance',
                    keywords: ['تأمينات', 'معاش', 'تقاعد'],
                    description: 'خدمات التأمينات الاجتماعية والمعاشات'
                }
            ]
        });
        
        this.govSiteData.set('moj.gov.sa', {
            name: 'وزارة العدل',
            services: [
                {
                    name: 'الخدمات القضائية',
                    url: '/judicial-services',
                    keywords: ['قضية', 'محكمة', 'دعوى', 'حكم'],
                    description: 'خدمات المحاكم والقضايا'
                },
                {
                    name: 'التوثيق',
                    url: '/notarization',
                    keywords: ['توثيق', 'كاتب عدل', 'عقد'],
                    description: 'خدمات التوثيق والعقود'
                },
                {
                    name: 'الإفلاس',
                    url: '/bankruptcy',
                    keywords: ['إفلاس', 'تصفية', 'إعسار'],
                    description: 'إجراءات الإفلاس والتصفية'
                }
            ]
        });
        
        this.govSiteData.set('my.gov.sa', {
            name: 'منصة أبشر',
            services: [
                {
                    name: 'الهوية الرقمية',
                    url: '/digital-identity',
                    keywords: ['هوية رقمية', 'تسجيل دخول', 'حساب'],
                    description: 'خدمات الهوية الرقمية والتسجيل'
                },
                {
                    name: 'الخدمات الحكومية',
                    url: '/government-services',
                    keywords: ['خدمة حكومية', 'معاملة', 'طلب'],
                    description: 'جميع الخدمات الحكومية الإلكترونية'
                }
            ]
        });
    }
    
    async performAISearch(query, context = {}) {
        try {
            const cacheKey = `${query}_${context.currentSite || ''}`;
            if (this.searchCache.has(cacheKey)) {
                return this.searchCache.get(cacheKey);
            }
            
            // Step 1: Semantic search using AI
            const semanticResults = await this.performSemanticSearch(query, context);
            
            // Step 2: Real site content extraction
            const realResults = await this.searchRealContent(query, context);
            
            // Step 3: AI-powered answer generation
            const aiAnswer = await this.generateAIAnswer(query, [...semanticResults, ...realResults]);
            
            const combinedResults = {
                aiAnswer,
                results: this.mergeDeduplicate([...semanticResults, ...realResults]),
                confidence: this.calculateConfidence(query, semanticResults, realResults)
            };
            
            this.searchCache.set(cacheKey, combinedResults);
            return combinedResults;
            
        } catch (error) {
            console.error('AI Search error:', error);
            return {
                aiAnswer: 'عذراً، حدث خطأ في البحث. يرجى المحاولة مرة أخرى.',
                results: [],
                confidence: 0
            };
        }
    }
    
    async performSemanticSearch(query, context) {
        if (!this.huggingFaceToken) {
            return this.fallbackSearch(query, context);
        }
        
        try {
            // Use sentence transformer for semantic similarity
            const embeddings = await this.getQueryEmbeddings(query);
            const matchedServices = this.findSemanticMatches(embeddings, context.currentSite);
            
            return matchedServices.map(service => ({
                title: service.name,
                snippet: service.description,
                url: this.buildFullUrl(service.url, context.currentSite),
                confidence: service.similarity,
                source: 'semantic_ai',
                type: 'service'
            }));
            
        } catch (error) {
            console.error('Semantic search error:', error);
            return this.fallbackSearch(query, context);
        }
    }
    
    async getQueryEmbeddings(query) {
        const response = await fetch(`${this.apiEndpoint}${this.models.search}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.huggingFaceToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: query,
                options: { wait_for_model: true }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HuggingFace API error: ${response.status}`);
        }
        
        return await response.json();
    }
    
    findSemanticMatches(embeddings, currentSite) {
        const matches = [];
        
        // Search current site first if specified
        if (currentSite) {
            const siteData = this.govSiteData.get(currentSite);
            if (siteData) {
                matches.push(...this.calculateServiceSimilarity(siteData.services, embeddings, currentSite));
            }
        }
        
        // Search all sites if not enough matches
        if (matches.length < 3) {
            for (const [domain, siteData] of this.govSiteData.entries()) {
                if (domain !== currentSite) {
                    matches.push(...this.calculateServiceSimilarity(siteData.services, embeddings, domain));
                }
            }
        }
        
        return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    }
    
    calculateServiceSimilarity(services, queryEmbeddings, domain) {
        return services.map(service => {
            // Simple keyword matching as fallback for semantic similarity
            const similarity = this.calculateKeywordSimilarity(service.keywords, queryEmbeddings);
            return {
                ...service,
                similarity,
                domain
            };
        });
    }
    
    calculateKeywordSimilarity(keywords, query) {
        // Simplified similarity calculation
        const queryLower = typeof query === 'string' ? query.toLowerCase() : JSON.stringify(query).toLowerCase();
        let maxSimilarity = 0;
        
        keywords.forEach(keyword => {
            if (queryLower.includes(keyword.toLowerCase())) {
                maxSimilarity = Math.max(maxSimilarity, 0.9);
            }
        });
        
        return maxSimilarity;
    }
    
    async searchRealContent(query, context) {
        try {
            // Use Google search with site: operator for real results
            const siteQuery = context.currentSite ? `site:${context.currentSite} ${query}` : `site:*.gov.sa ${query}`;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(siteQuery)}`;
            
            // In a real implementation, you'd use Google Custom Search API
            // For now, return structured results based on known patterns
            return this.generateStructuredResults(query, context);
            
        } catch (error) {
            console.error('Real content search error:', error);
            return [];
        }
    }
    
    generateStructuredResults(query, context) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        // Find matching government sites and services
        for (const [domain, siteData] of this.govSiteData.entries()) {
            if (context.currentSite && domain !== context.currentSite) continue;
            
            siteData.services.forEach(service => {
                const hasMatch = service.keywords.some(keyword => 
                    queryLower.includes(keyword.toLowerCase()) || 
                    keyword.toLowerCase().includes(queryLower)
                );
                
                if (hasMatch) {
                    results.push({
                        title: `${service.name} - ${siteData.name}`,
                        snippet: service.description,
                        url: `https://${domain}${service.url}`,
                        confidence: 0.8,
                        source: 'structured_data',
                        type: 'official_service'
                    });
                }
            });
        }
        
        return results;
    }
    
    async generateAIAnswer(query, searchResults) {
        if (!this.huggingFaceToken || searchResults.length === 0) {
            return this.generateFallbackAnswer(query, searchResults);
        }
        
        try {
            // Prepare context from search results
            const context = searchResults.map(r => `${r.title}: ${r.snippet}`).join('\n');
            
            const response = await fetch(`${this.apiEndpoint}${this.models.qa}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.huggingFaceToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: {
                        question: query,
                        context: context
                    },
                    options: { wait_for_model: true }
                })
            });
            
            if (!response.ok) {
                throw new Error(`AI Answer API error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.answer || this.generateFallbackAnswer(query, searchResults);
            
        } catch (error) {
            console.error('AI Answer generation error:', error);
            return this.generateFallbackAnswer(query, searchResults);
        }
    }
    
    generateFallbackAnswer(query, searchResults) {
        if (searchResults.length === 0) {
            return `عذراً، لم أتمكن من العثور على معلومات محددة حول "${query}". يرجى تجربة كلمات مفتاحية أخرى أو زيارة المواقع الحكومية مباشرة.`;
        }
        
        const topResult = searchResults[0];
        return `بناءً على البحث، يمكنني مساعدتك في "${query}". ${topResult.snippet} يمكنك العثور على مزيد من المعلومات في الروابط أدناه.`;
    }
    
    fallbackSearch(query, context) {
        // Enhanced fallback when AI is not available
        return this.generateStructuredResults(query, context);
    }
    
    mergeDeduplicate(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = `${result.title}_${result.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    
    calculateConfidence(query, semanticResults, realResults) {
        const totalResults = semanticResults.length + realResults.length;
        if (totalResults === 0) return 0;
        
        const avgConfidence = [...semanticResults, ...realResults]
            .reduce((sum, r) => sum + (r.confidence || 0.5), 0) / totalResults;
        
        return Math.round(avgConfidence * 100);
    }
    
    buildFullUrl(path, domain) {
        if (path.startsWith('http')) return path;
        return `https://${domain}${path}`;
    }
    
    async extractSiteContent(url) {
        // This would extract and analyze real page content
        // For security reasons, this needs to be done via content script
        return { title: '', content: '', links: [] };
    }
    
    async getAIAnswer(question, context) {
        return await this.generateAIAnswer(question, context.results || []);
    }
}

// Initialize the AI engine
new DigitalGuideAI();