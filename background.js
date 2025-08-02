class DigitalGuideAI {
    constructor() {
        // Free and low-cost API configuration
        this.aiConfig = {
            // Primary: Google Gemini (Free tier: 15 requests/minute, 1500/day)
            gemini: {
                apiKey: 'YOAIzaSyDm5z6Xf6Ea5HUtiZtCUR7J-q77C5BbuUk', // Replace with your key
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
                free: true,
                limit: { requests: 15, period: 'minute' }
            },
            
            // Backup: Cohere (Free tier: 100 requests/minute)
            cohere: {
                apiKey: 'nEaJVfqHG6yoHD7Ow4ponVAtt38dPhpNB58ZLE7v', // Replace with your key
                endpoint: 'https://api.cohere.ai/v1/generate',
                free: true,
                limit: { requests: 100, period: 'minute' }
            },
            
            // Emergency fallback: Local processing only
            localOnly: false,
            
            // Rate limiting
            requestCounts: {
                gemini: { count: 0, resetTime: 0 },
                cohere: { count: 0, resetTime: 0 }
            }
        };
        
        this.govSiteData = new Map();
        this.searchCache = new Map();
        this.aiCache = new Map();
        
        this.init();
    }
    
    init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        this.initGovSiteKnowledge();
        this.setupAdvancedLocalAI();
        this.startCacheCleanup();
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'ai_search':
                    const results = await this.performAdvancedAISearch(request.query, request.context);
                    sendResponse({ success: true, results });
                    break;
                    
                case 'get_ai_answer':
                    const answer = await this.getAdvancedAIAnswer(request.question, request.context);
                    sendResponse({ success: true, answer });
                    break;
                    
                case 'generate_questions':
                    const questions = await this.generateRelatedQuestions(request.context);
                    sendResponse({ success: true, questions });
                    break;
                    
                case 'check_ai_status':
                    const status = await this.checkAIServiceStatus();
                    sendResponse({ success: true, status });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    setupAdvancedLocalAI() {
        // Enhanced local AI with Saudi government domain knowledge
        this.localAI = {
            servicePatterns: {
                'رخصة عمل': {
                    response: 'للحصول على رخصة عمل للعمالة الوافدة، يجب التقديم عبر منصة وزارة العمل والتنمية الاجتماعية',
                    ministry: 'وزارة العمل والتنمية الاجتماعية',
                    url: 'https://hrsd.gov.sa',
                    steps: ['تسجيل الدخول في المنصة', 'تعبئة بيانات العامل', 'رفع المستندات المطلوبة', 'دفع الرسوم', 'متابعة حالة الطلب'],
                    requirements: ['جواز سفر ساري', 'عقد عمل', 'شهادة خلو من الأمراض']
                },
                
                'تأمينات اجتماعية': {
                    response: 'التأمينات الاجتماعية تشمل تأمين الشيخوخة والعجز والوفاة وإصابات العمل والبطالة',
                    ministry: 'المؤسسة العامة للتأمينات الاجتماعية',
                    url: 'https://gosi.gov.sa',
                    steps: ['التسجيل في النظام', 'دفع الاشتراكات الشهرية', 'متابعة الحساب التأميني', 'طلب المعاش عند الاستحقاق'],
                    benefits: ['معاش الشيخوخة', 'معاش العجز', 'إعانة البطالة (ساند)', 'تعويض إصابات العمل']
                },
                
                'توثيق': {
                    response: 'خدمات التوثيق متاحة عبر وزارة العدل لتوثيق العقود والوكالات والإقرارات',
                    ministry: 'وزارة العدل',
                    url: 'https://moj.gov.sa',
                    steps: ['حجز موعد إلكتروني', 'إحضار المستندات الأصلية', 'حضور الأطراف المعنية', 'دفع الرسوم', 'استلام الوثيقة الموثقة'],
                    types: ['توثيق عقود', 'توثيق وكالات', 'توثيق إقرارات', 'توثيق تنازل']
                },
                
                'محكمة': {
                    response: 'الخدمات القضائية الإلكترونية متاحة عبر منصة ناجز لتقديم الدعاوى ومتابعة القضايا',
                    ministry: 'وزارة العدل',
                    url: 'https://najiz.moj.gov.sa',
                    steps: ['إنشاء حساب في ناجز', 'تقديم الدعوى إلكترونياً', 'رفع المستندات', 'متابعة مراحل القضية', 'استلام الأحكام'],
                    courts: ['محاكم الدرجة الأولى', 'محاكم الاستئناف', 'المحكمة العليا']
                },
                
                'أبشر': {
                    response: 'منصة أبشر توفر أكثر من 200 خدمة حكومية إلكترونية للمواطنين والمقيمين',
                    ministry: 'وزارة الداخلية',
                    url: 'https://my.gov.sa',
                    services: ['إصدار التأشيرات', 'تجديد الإقامة', 'خدمات المرور', 'الجوازات', 'الأحوال المدنية'],
                    features: ['الهوية الرقمية', 'التوقيع الإلكتروني', 'الدفع الإلكتروني', 'المتابعة الفورية']
                }
            },
            
            analyzeQuery: (query, context = {}) => {
                const queryLower = query.toLowerCase();
                let bestMatch = null;
                let highestScore = 0;
                
                for (const [pattern, data] of Object.entries(this.localAI.servicePatterns)) {
                    const score = this.calculateAdvancedScore(queryLower, pattern, data);
                    if (score > highestScore && score > 0.4) {
                        highestScore = score;
                        bestMatch = { ...data, pattern, score };
                    }
                }
                
                return bestMatch;
            },
            
            generateContextualResponse: (match, query) => {
                if (!match) return null;
                
                let response = match.response;
                
                if (query.includes('كيف') && match.steps) {
                    response += '\n\nالخطوات المطلوبة:\n';
                    match.steps.forEach((step, index) => {
                        response += `${index + 1}. ${step}\n`;
                    });
                }
                
                if ((query.includes('مستند') || query.includes('وثائق')) && match.requirements) {
                    response += '\n\nالمستندات المطلوبة:\n';
                    match.requirements.forEach(req => {
                        response += `• ${req}\n`;
                    });
                }
                
                if ((query.includes('فوائد') || query.includes('مزايا')) && match.benefits) {
                    response += '\n\nالفوائد والمزايا:\n';
                    match.benefits.forEach(benefit => {
                        response += `• ${benefit}\n`;
                    });
                }
                
                return response;
            }
        };
    }
    
    calculateAdvancedScore(query, pattern, data) {
        let score = 0;
        
        if (query.includes(pattern.toLowerCase())) {
            score += 0.9;
        }
        
        const patternWords = pattern.split(' ');
        patternWords.forEach(word => {
            if (query.includes(word.toLowerCase())) {
                score += 0.3;
            }
        });
        
        const searchableText = `${data.response} ${data.ministry || ''} ${(data.steps || []).join(' ')}`.toLowerCase();
        const queryWords = query.split(' ');
        queryWords.forEach(word => {
            if (word.length > 2 && searchableText.includes(word)) {
                score += 0.2;
            }
        });
        
        return Math.min(score, 1.0);
    }
    
    initGovSiteKnowledge() {
        this.govSiteData.set('hrsd.gov.sa', {
            name: 'وزارة العمل والتنمية الاجتماعية',
            nameEn: 'Ministry of Human Resources and Social Development',
            services: [
                {
                    name: 'تصاريح العمل للعمالة الوافدة',
                    nameEn: 'Work Permits for Expat Workers',
                    url: '/services/work-permits',
                    keywords: ['رخصة عمل', 'تصريح عمل', 'إذن عمل', 'عمالة وافدة', 'استقدام', 'visa', 'work permit'],
                    description: 'خدمات إصدار وتجديد وإلغاء تصاريح العمل للعمالة الوافدة من جميع الجنسيات',
                    steps: ['تسجيل الدخول في منصة قوى', 'اختيار نوع الخدمة', 'تعبئة بيانات العامل', 'رفع المستندات', 'دفع الرسوم', 'متابعة الطلب'],
                    requirements: ['جواز سفر ساري المفعول', 'عقد عمل موثق', 'شهادة خلو من الأمراض', 'مؤهلات العامل'],
                    fees: 'تختلف حسب نوع المهنة ومدة العقد',
                    duration: '5-10 أيام عمل',
                    category: 'عمل'
                }
            ]
        });
        
        this.govSiteData.set('moj.gov.sa', {
            name: 'وزارة العدل',
            nameEn: 'Ministry of Justice',
            services: [
                {
                    name: 'الخدمات القضائية الإلكترونية (ناجز)',
                    nameEn: 'Electronic Judicial Services (Najiz)',
                    url: '/najiz',
                    keywords: ['ناجز', 'قضية', 'محكمة', 'دعوى', 'حكم', 'استئناف', 'najiz', 'court'],
                    description: 'منصة إلكترونية شاملة للخدمات القضائية وتقديم الدعاوى',
                    steps: ['إنشاء حساب في ناجز', 'اختيار نوع الدعوى', 'تعبئة البيانات', 'رفع المستندات', 'دفع الرسوم', 'متابعة القضية'],
                    services_available: ['تقديم الدعاوى', 'متابعة القضايا', 'استلام الأحكام', 'طلب الاستئناف'],
                    category: 'قضاء'
                }
            ]
        });
    }
    
    async performAdvancedAISearch(query, context = {}) {
        try {
            const cacheKey = `advanced_search_${query}_${context.currentSite || ''}`;
            if (this.searchCache.has(cacheKey)) {
                return this.searchCache.get(cacheKey);
            }
            
            // Step 1: Enhanced local analysis
            const localAnalysis = this.localAI.analyzeQuery(query, context);
            
            // Step 2: Knowledge base search
            const knowledgeResults = await this.searchEnhancedKnowledgeBase(query, context);
            
            // Step 3: Try AI enhancement (free APIs)
            const aiAnswer = await this.generateAdvancedAIAnswer(query, knowledgeResults, localAnalysis);
            
            // Step 4: Generate related questions
            const relatedQuestions = this.generateLocalRelatedQuestions({ query });
            
            const results = {
                aiAnswer,
                results: knowledgeResults,
                confidence: this.calculateAdvancedConfidence(query, knowledgeResults, localAnalysis),
                relatedQuestions,
                localAnalysis,
                timestamp: Date.now()
            };
            
            this.searchCache.set(cacheKey, results);
            return results;
            
        } catch (error) {
            console.error('Advanced AI Search error:', error);
            return this.fallbackToLocalAI(query, context);
        }
    }
    
    async generateAdvancedAIAnswer(query, knowledgeResults, localAnalysis) {
        // Try free AI APIs in order of preference
        const providers = ['gemini', 'cohere'];
        
        for (const provider of providers) {
            if (this.checkRateLimit(provider)) {
                try {
                    const answer = await this.callFreeAI(provider, query, knowledgeResults, localAnalysis);
                    if (answer && answer.length > 20) {
                        this.incrementRequestCount(provider);
                        return answer;
                    }
                } catch (error) {
                    console.error(`${provider} API failed:`, error);
                    continue;
                }
            }
        }
        
        // Fallback to enhanced local processing
        return this.generateEnhancedLocalAnswer(query, knowledgeResults, localAnalysis);
    }
    
    async callFreeAI(provider, query, knowledgeResults, localAnalysis) {
        const cacheKey = `${provider}_${query}`;
        if (this.aiCache.has(cacheKey)) {
            return this.aiCache.get(cacheKey);
        }
        
        let context = '';
        if (localAnalysis) {
            context += `تحليل محلي: ${localAnalysis.response}\n\n`;
        }
        
        if (knowledgeResults.length > 0) {
            context += 'المعلومات الرسمية:\n';
            knowledgeResults.slice(0, 3).forEach((result, index) => {
                context += `${index + 1}. ${result.title}: ${result.snippet}\n`;
            });
        }
        
        let response;
        
        if (provider === 'gemini') {
            response = await this.callGemini(query, context);
        } else if (provider === 'cohere') {
            response = await this.callCohere(query, context);
        }
        
        if (response) {
            const cleanedAnswer = this.cleanAIResponse(response, query);
            this.aiCache.set(cacheKey, cleanedAnswer);
            return cleanedAnswer;
        }
        
        return null;
    }
    
    async callGemini(query, context) {
        const config = this.aiConfig.gemini;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `أنت مساعد ذكي متخصص في الخدمات الحكومية السعودية. اجب على السؤال التالي باللغة العربية بدقة ووضوح:

${context}

السؤال: ${query}

الرجاء تقديم إجابة شاملة ومفيدة تتضمن الخطوات العملية والمعلومات المهمة.`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 400
            }
        };
        
        const response = await fetch(`${config.endpoint}?key=${config.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    
    async callCohere(query, context) {
        const config = this.aiConfig.cohere;
        
        const requestBody = {
            model: 'command-light',
            prompt: `أنت مساعد ذكي متخصص في الخدمات الحكومية السعودية. اجب على السؤال التالي باللغة العربية:

${context}

السؤال: ${query}

الإجابة:`,
            max_tokens: 400,
            temperature: 0.7
        };
        
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`Cohere API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.generations?.[0]?.text;
    }
    
    checkRateLimit(provider) {
        const now = Date.now();
        const config = this.aiConfig.requestCounts[provider];
        const limit = this.aiConfig[provider].limit;
        
        // Reset counter if period has passed
        const periodMs = limit.period === 'minute' ? 60000 : 86400000; // minute or day
        if (now - config.resetTime > periodMs) {
            config.count = 0;
            config.resetTime = now;
        }
        
        return config.count < limit.requests;
    }
    
    incrementRequestCount(provider) {
        this.aiConfig.requestCounts[provider].count++;
    }
    
    cleanAIResponse(answer, originalQuery) {
        answer = answer.replace(new RegExp(originalQuery, 'gi'), '');
        answer = answer.replace(/^(الإجابة:|Answer:|اجب:|إجابة:)/i, '').trim();
        answer = answer.replace(/\n\n+/g, '\n\n');
        
        if (answer.length > 800) {
            answer = answer.substring(0, 800) + '...';
        }
        
        return answer;
    }
    
    generateEnhancedLocalAnswer(query, knowledgeResults, localAnalysis) {
        let answer = '';
        
        if (localAnalysis) {
            answer = this.localAI.generateContextualResponse(localAnalysis, query);
        }
        
        if (!answer && knowledgeResults.length > 0) {
            const topResult = knowledgeResults[0];
            answer = `بناءً على البحث في الخدمات الحكومية الرسمية: ${topResult.snippet}`;
            
            if (topResult.steps && topResult.steps.length > 0) {
                answer += '\n\nالخطوات المطلوبة:\n';
                topResult.steps.forEach((step, index) => {
                    answer += `${index + 1}. ${step}\n`;
                });
            }
        }
        
        if (!answer) {
            answer = `عذراً، لم أتمكن من العثور على معلومات محددة حول "${query}". يرجى تجربة كلمات أخرى أو زيارة المواقع الحكومية مباشرة.`;
        }
        
        answer += '\n\nيمكنك العثور على المزيد من التفاصيل في الروابط الرسمية أدناه.';
        
        return answer;
    }
    
    generateLocalRelatedQuestions(context) {
        const query = context.query.toLowerCase();
        const related = [];
        
        if (query.includes('رخصة') || query.includes('تصريح')) {
            related.push('ما هي المستندات المطلوبة؟', 'كم تبلغ الرسوم؟', 'ما هي مدة الإنجاز؟', 'كيف أتابع الطلب؟');
        } else if (query.includes('تأمين') || query.includes('معاش')) {
            related.push('كيف احسب المعاش؟', 'متى استحق التقاعد؟', 'كيف أحدث البيانات؟', 'ما هي فوائد التأمين؟');
        } else if (query.includes('توثيق') || query.includes('عقد')) {
            related.push('أين أحجز موعد؟', 'ما هي الرسوم؟', 'ما الوثائق المطلوبة؟', 'كم يستغرق التوثيق؟');
        } else if (query.includes('محكمة') || query.includes('قضية')) {
            related.push('كيف أقدم دعوى؟', 'ما هي إجراءات المحكمة؟', 'كيف أتابع القضية؟', 'ما هي رسوم المحكمة؟');
        } else {
            related.push('ما هي ساعات العمل؟', 'كيف أتواصل مع الوزارة؟', 'هل الخدمة متاحة إلكترونياً؟', 'ما هي الفروع المتاحة؟');
        }
        
        return related.slice(0, 4);
    }
    
    async searchEnhancedKnowledgeBase(query, context) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (const [domain, siteData] of this.govSiteData.entries()) {
            if (context.currentSite && domain !== context.currentSite) continue;
            
            siteData.services.forEach(service => {
                const score = this.calculateEnhancedRelevance(queryLower, service);
                if (score > 0.3) {
                    results.push({
                        title: `${service.name} - ${siteData.name}`,
                        snippet: service.description,
                        url: `https://${domain}${service.url}`,
                        relevance: score,
                        confidence: score,
                        source: 'enhanced_knowledge_base',
                        type: 'official_service',
                        steps: service.steps || [],
                        requirements: service.requirements || [],
                        category: service.category || '',
                        ministry: siteData.name,
                        fees: service.fees || '',
                        duration: service.duration || ''
                    });
                }
            });
        }
        
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 8);
    }
    
    calculateEnhancedRelevance(query, service) {
        let score = 0;
        const queryWords = query.split(/\s+/).filter(word => word.length > 1);
        
        service.keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            if (query.includes(keywordLower)) {
                score += 0.8;
            }
            
            queryWords.forEach(word => {
                if (keywordLower.includes(word)) {
                    score += 0.4;
                }
            });
        });
        
        const searchableText = `${service.name} ${service.nameEn || ''} ${service.description}`.toLowerCase();
        queryWords.forEach(word => {
            if (searchableText.includes(word)) {
                score += 0.3;
            }
        });
        
        if (service.category && query.includes(service.category)) {
            score += 0.5;
        }
        
        if (query.includes('كيف') || query.includes('خطوات')) {
            if (service.steps && service.steps.length > 0) {
                score += 0.3;
            }
        }
        
        if (query.includes('مستند') || query.includes('وثائق')) {
            if (service.requirements && service.requirements.length > 0) {
                score += 0.3;
            }
        }
        
        return Math.min(score, 1.0);
    }
    
    calculateAdvancedConfidence(query, knowledgeResults, localAnalysis) {
        let confidence = 40;
        
        if (localAnalysis && localAnalysis.score > 0.7) {
            confidence += 30;
        }
        
        if (knowledgeResults.length > 0) {
            confidence += Math.min(knowledgeResults.length * 8, 25);
            
            const avgRelevance = knowledgeResults.reduce((sum, r) => sum + (r.relevance || 0.5), 0) / knowledgeResults.length;
            confidence += avgRelevance * 20;
        }
        
        if (this.isArabicQuery(query)) {
            confidence += 10;
        }
        
        if (this.isGovernmentQuery(query)) {
            confidence += 15;
        }
        
        return Math.min(Math.round(confidence), 92);
    }
    
    isArabicQuery(query) {
        const arabicChars = query.match(/[\u0600-\u06FF]/g) || [];
        return arabicChars.length / query.length > 0.3;
    }
    
    isGovernmentQuery(query) {
        const govTerms = ['وزارة', 'حكومة', 'رسمي', 'خدمة', 'إجراء', 'ministry', 'government', 'official'];
        return govTerms.some(term => query.toLowerCase().includes(term.toLowerCase()));
    }
    
    async checkAIServiceStatus() {
        return {
            status: 'ready',
            message: 'خدمات الذكاء الاصطناعي جاهزة (APIs مجانية)',
            models_available: true,
            free_tier: true,
            rate_limits: {
                gemini: this.aiConfig.requestCounts.gemini,
                cohere: this.aiConfig.requestCounts.cohere
            }
        };
    }
    
    async getAdvancedAIAnswer(question, context) {
        const results = context.results || [];
        const localAnalysis = this.localAI.analyzeQuery(question, context);
        
        return await this.generateAdvancedAIAnswer(question, results, localAnalysis);
    }
    
    fallbackToLocalAI(query, context) {
        const localAnalysis = this.localAI.analyzeQuery(query, context);
        const knowledgeResults = this.searchEnhancedKnowledgeBase(query, context);
        
        const answer = localAnalysis ? 
            this.localAI.generateContextualResponse(localAnalysis, query) :
            this.generateEnhancedLocalAnswer(query, knowledgeResults, null);
        
        return {
            aiAnswer: answer,
            results: knowledgeResults,
            confidence: this.calculateAdvancedConfidence(query, knowledgeResults, localAnalysis) - 15,
            relatedQuestions: this.generateLocalRelatedQuestions({ query }),
            source: 'local_ai',
            timestamp: Date.now()
        };
    }
    
    clearCache() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const [key, entry] of this.searchCache.entries()) {
            if (entry.timestamp && now - entry.timestamp > oneHour) {
                this.searchCache.delete(key);
            }
        }
        
        for (const [key, entry] of this.aiCache.entries()) {
            if (entry.timestamp && now - entry.timestamp > oneHour) {
                this.aiCache.delete(key);
            }
        }
    }
    
    startCacheCleanup() {
        setInterval(() => {
            this.clearCache();
        }, 30 * 60 * 1000);
    }
}

// Initialize the enhanced AI engine
const digitalGuideAI = new DigitalGuideAI();
digitalGuideAI.startCacheCleanup();
