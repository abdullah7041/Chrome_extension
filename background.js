class DigitalGuideAI {
    constructor() {
        // Free and low-cost API configuration
        this.aiConfig = {
            // Primary: Google Gemini (Free tier: 15 requests/minute, 1500/day)
            gemini: {
                apiKey: 'YOUR_GEMINI_API_KEY', // Replace with your actual key
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
                free: true,
                limit: { requests: 15, period: 'minute' }
            },
            
            // Backup: Cohere (Free tier: 100 requests/minute)
            cohere: {
                apiKey: 'YOUR_COHERE_API_KEY', // Replace with your actual key
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
        
        // Validate API key
        if (!config.apiKey || config.apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Error('Gemini API key not configured');
        }
        
        // Ensure text length is reasonable for the free tier
        const maxContextLength = 300;
        const maxQueryLength = 150;
        const truncatedContext = context.length > maxContextLength ? context.substring(0, maxContextLength) + '...' : context;
        const truncatedQuery = query.length > maxQueryLength ? query.substring(0, maxQueryLength) + '...' : query;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `أنت خبير متخصص في الخدمات الحكومية السعودية ومساعد خدمة عملاء من الطراز الأول. مهمتك إرضاء المستخدم بتقديم إجابات شاملة ومفيدة تغنيه عن البحث.

قدراتك:
- خبرة عميقة في جميع الوزارات والهيئات الحكومية السعودية
- تقديم روابط مباشرة ومفيدة
- حساب الرسوم والمدد الزمنية
- توضيح الخطوات بالتفصيل
- ذكر المستندات المطلوبة بدقة
- تقديم أرقام التواصل ومواعيد العمل

المعلومات المتوفرة:
${truncatedContext}

استفسار المستخدم: ${truncatedQuery}

قدم إجابة شاملة تتضمن:
1. الإجابة الأساسية واضحة ومباشرة
2. الخطوات العملية المطلوبة (إن وجدت)
3. الرسوم المتوقعة والمدة الزمنية
4. الروابط أو أرقام التواصل المفيدة
5. نصائح إضافية مفيدة

اكتب باللغة العربية وبأسلوب احترافي ومفيد:`
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 400,
                topP: 0.9,
                topK: 40,
                stopSequences: ["المستخدم:", "السؤال:", "الاستفسار:"]
            }
        };
        
        try {
            const response = await fetch(`${config.endpoint}?key=${config.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API error details:', response.status, errorText);
                
                // Handle specific error cases
                if (response.status === 404) {
                    throw new Error('Gemini model not found - API may have changed');
                } else if (response.status === 403) {
                    throw new Error('Gemini API access denied - check your API key');
                } else if (response.status === 429) {
                    throw new Error('Gemini API rate limit exceeded');
                }
                
                throw new Error(`Gemini API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Gemini API error: ${data.error.message}`);
            }
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('No response generated by Gemini');
            }
            
            const candidate = data.candidates[0];
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('Response blocked by safety filters');
            }
            
            return candidate.content?.parts?.[0]?.text;
            
        } catch (fetchError) {
            console.error('Gemini fetch error:', fetchError);
            this.logAPIError('gemini', fetchError, query);
            throw fetchError;
        }
    }
    
    async callCohere(query, context) {
        const config = this.aiConfig.cohere;
        
        // Validate API key
        if (!config.apiKey || config.apiKey === 'YOUR_COHERE_API_KEY') {
            throw new Error('Cohere API key not configured');
        }
        
        // Ensure text length is reasonable
        const maxLength = 400;
        const truncatedContext = context.length > maxLength ? context.substring(0, maxLength) + '...' : context;
        const truncatedQuery = query.length > 150 ? query.substring(0, 150) + '...' : query;
        
        const requestBody = {
            model: 'command',
            prompt: `أنت خبير خدمة عملاء متميز متخصص في الخدمات الحكومية السعودية. هدفك الأساسي هو إرضاء المستخدم وتوفير كل ما يحتاجه من معلومات دون الحاجة للبحث في مكان آخر.

خبراتك تشمل:
• معرفة شاملة بجميع الوزارات والهيئات الحكومية
• تقديم روابط مباشرة ومفيدة للخدمات
• حساب الرسوم والمدد الزمنية بدقة
• توضيح المتطلبات والمستندات
• أرقام التواصل ومواعيد العمل

المعلومات المرجعية: ${truncatedContext}

استفسار العميل: ${truncatedQuery}

قدم خدمة عملاء متميزة تتضمن:
- إجابة شاملة ومباشرة
- تفاصيل عملية (خطوات، رسوم، مدد)
- روابط أو معلومات تواصل مفيدة
- نصائح تطبيقية

الإجابة (باللغة العربية، احترافية ومفصلة):`,
            max_tokens: 300,
            temperature: 0.3,
            p: 0.9,
            k: 0,
            stop_sequences: ["العميل:", "الاستفسار:", "السؤال:", "\n---"],
            return_likelihoods: 'NONE'
        };
        
        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Cohere-Version': '2022-12-06'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cohere API error details:', response.status, errorText);
                throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.message) {
                throw new Error(`Cohere API error: ${data.message}`);
            }
            
            return data.generations?.[0]?.text?.trim();
            
        } catch (fetchError) {
            console.error('Cohere fetch error:', fetchError);
            throw fetchError;
        }
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
        if (!answer) return '';
        
        // Remove query echoing
        answer = answer.replace(new RegExp(originalQuery, 'gi'), '');
        
        // Remove common prefixes
        answer = answer.replace(/^(الإجابة:|Answer:|اجب:|إجابة:|الجواب:)/i, '').trim();
        
        // Clean up multiple newlines
        answer = answer.replace(/\n\n+/g, '\n\n');
        
        // Remove leading/trailing whitespace
        answer = answer.trim();
        
        // Limit length
        if (answer.length > 600) {
            answer = answer.substring(0, 600) + '...';
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
            answer = `📋 **${topResult.ministry}**\n\n`;
            answer += `${topResult.snippet}\n\n`;
            
            if (topResult.steps && topResult.steps.length > 0) {
                answer += `**📝 الخطوات المطلوبة:**\n`;
                topResult.steps.forEach((step, index) => {
                    answer += `${index + 1}. ${step}\n`;
                });
                answer += '\n';
            }
            
            if (topResult.requirements && topResult.requirements.length > 0) {
                answer += `**📄 المستندات المطلوبة:**\n`;
                topResult.requirements.forEach(req => {
                    answer += `• ${req}\n`;
                });
                answer += '\n';
            }
            
            if (topResult.fees) {
                answer += `**💰 الرسوم:** ${topResult.fees}\n`;
            }
            
            if (topResult.duration) {
                answer += `**⏱️ مدة الإنجاز:** ${topResult.duration}\n`;
            }
            
            answer += `\n**🔗 الرابط الرسمي:** ${topResult.url}`;
        }
        
        if (!answer) {
            answer = `عذراً، لم أعثر على معلومات محددة حول "${query}".\n\n`;
            answer += `**💡 نصائح للبحث:**\n`;
            answer += `• جرب كلمات أخرى أو مرادفات\n`;
            answer += `• تأكد من كتابة الخدمة بوضوح\n`;
            answer += `• يمكنك زيارة المواقع الحكومية مباشرة\n\n`;
            answer += `**📞 للاستفسار:** اتصل على 19993 (الخط الموحد للخدمات الحكومية)`;
        }
        
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
        const status = {
            status: 'ready',
            message: 'خدمات الذكاء الاصطناعي جاهزة',
            models_available: false,
            free_tier: true,
            rate_limits: {
                gemini: this.aiConfig.requestCounts.gemini,
                cohere: this.aiConfig.requestCounts.cohere
            },
            errors: []
        };
        
        // Check Gemini API key
        if (!this.aiConfig.gemini.apiKey || this.aiConfig.gemini.apiKey === 'YOUR_GEMINI_API_KEY') {
            status.errors.push('Gemini API key not configured');
        } else {
            status.models_available = true;
        }
        
        // Check Cohere API key
        if (!this.aiConfig.cohere.apiKey || this.aiConfig.cohere.apiKey === 'YOUR_COHERE_API_KEY') {
            status.errors.push('Cohere API key not configured');
        } else {
            status.models_available = true;
        }
        
        if (status.errors.length > 0) {
            status.status = 'limited';
            status.message = 'خدمات الذكاء الاصطناعي محدودة - يرجى تكوين مفاتيح API';
        }
        
        return status;
    }
    
    async getAdvancedAIAnswer(question, context) {
        const results = context.results || [];
        const localAnalysis = this.localAI.analyzeQuery(question, context);
        
        return await this.generateAdvancedAIAnswer(question, results, localAnalysis);
    }
    
    async generateRelatedQuestions(context) {
        return this.generateLocalRelatedQuestions(context);
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
        }, 30 * 60 * 1000); // Clean cache every 30 minutes
    }
    
    // Additional utility methods for better error handling
    validateAPIKeys() {
        const issues = [];
        
        if (!this.aiConfig.gemini.apiKey || this.aiConfig.gemini.apiKey === 'YOUR_GEMINI_API_KEY') {
            issues.push('Gemini API key missing or not configured');
        }
        
        if (!this.aiConfig.cohere.apiKey || this.aiConfig.cohere.apiKey === 'YOUR_COHERE_API_KEY') {
            issues.push('Cohere API key missing or not configured');
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
    
    async testAPIConnection(provider) {
        try {
            if (provider === 'gemini') {
                const response = await this.callGemini('test', 'Test connection');
                return { success: true, response };
            } else if (provider === 'cohere') {
                const response = await this.callCohere('test', 'Test connection');
                return { success: true, response };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Enhanced logging for debugging
    logAPIError(provider, error, query) {
        console.group(`🚨 ${provider.toUpperCase()} API Error`);
        console.error('Error:', error.message);
        console.log('Query:', query);
        console.log('Provider config:', this.aiConfig[provider]);
        console.log('Rate limit status:', this.aiConfig.requestCounts[provider]);
        console.groupEnd();
    }
    
    // Method to reset rate limits (useful for testing)
    resetRateLimits() {
        Object.keys(this.aiConfig.requestCounts).forEach(provider => {
            this.aiConfig.requestCounts[provider] = { count: 0, resetTime: 0 };
        });
        console.log('Rate limits reset for all providers');
    }
    
    // Method to get available Gemini models (for debugging)
    async getAvailableGeminiModels() {
        const config = this.aiConfig.gemini;
        if (!config.apiKey || config.apiKey === 'YOUR_GEMINI_API_KEY') {
            return { error: 'API key not configured' };
        }
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { error: error.message };
        }
    }
    
    // Method to get detailed status for debugging
    getDetailedStatus() {
        return {
            apiKeys: this.validateAPIKeys(),
            rateLimits: this.aiConfig.requestCounts,
            cacheStats: {
                searchCache: this.searchCache.size,
                aiCache: this.aiCache.size
            },
            govSiteData: this.govSiteData.size,
            localAIPatterns: Object.keys(this.localAI.servicePatterns).length
        };
    }
}

// Initialize the enhanced AI engine
const digitalGuideAI = new DigitalGuideAI();

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DigitalGuideAI;
}