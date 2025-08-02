class DigitalGuideAI {
    constructor() {
        // Enhanced HuggingFace configuration - completely free and secure
        this.aiConfig = {
            // Your existing HuggingFace token (read-only, safer for extensions)
            huggingFaceToken: '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', // Replace with your actual token
            apiEndpoint: 'https://api-inference.huggingface.co/models/',
            
            // Modern, high-quality models for better results
            models: {
                // Arabic-optimized models for better Saudi government context
                'arabic_qa': 'CAMeL-Lab/bert-base-arabic-camelbert-msa-qa', // Best for Arabic Q&A
                'arabic_text': 'aubmindlab/bert-base-arabert', // Arabic text understanding
                'multilingual_qa': 'deepset/roberta-base-squad2', // Multilingual Q&A
                
                // Advanced text generation (much better than GPT-3.5-turbo)
                'text_generation': 'microsoft/DialoGPT-large', // Better conversational AI
                'instruction_following': 'google/flan-t5-large', // Instruction-following model
                
                // Semantic search and embeddings
                'embeddings': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', // Multilingual embeddings
                'arabic_embeddings': 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
                
                // Specialized models for government content
                'summarization': 'facebook/bart-large-cnn', // Text summarization
                'question_generation': 'valhalla/t5-small-qg-hl', // Generate related questions
            },
            
            // Fallback system
            fallbackEnabled: true,
            maxRetries: 3,
            timeoutMs: 15000
        };
        
        this.govSiteData = new Map();
        this.searchCache = new Map();
        this.aiCache = new Map();
        this.requestCount = 0;
        this.maxRequestsPerHour = 500; // HuggingFace has generous limits
        
        this.init();
    }
    
    init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
       
        this.initGovSiteKnowledge();
        this.setupAdvancedLocalAI();
        this.loadUserToken(); // Load user's existing token if available
    }
    
    async loadUserToken() {
        // Load existing HuggingFace token from storage (backward compatibility)
        try {
            const result = await chrome.storage.local.get(['huggingface_token']);
            if (result.huggingface_token) {
                this.aiConfig.huggingFaceToken = result.huggingface_token;
                console.log('Using user-provided HuggingFace token');
            } else if (this.aiConfig.huggingFaceToken === 'hf_your_existing_token_here') {
                console.log('Please add your HuggingFace token to background.js');
            }
        } catch (error) {
            console.error('Error loading token:', error);
        }
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
                    sendResponse({ success: true, status, hasToken: !!this.aiConfig.huggingFaceToken });
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
            // Comprehensive Saudi government knowledge patterns
            servicePatterns: {
                // Work and Labor
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
                
                // Justice Ministry
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
                
                // Digital Government
                'أبشر': {
                    response: 'منصة أبشر توفر أكثر من 200 خدمة حكومية إلكترونية للمواطنين والمقيمين',
                    ministry: 'وزارة الداخلية',
                    url: 'https://my.gov.sa',
                    services: ['إصدار التأشيرات', 'تجديد الإقامة', 'خدمات المرور', 'الجوازات', 'الأحوال المدنية'],
                    features: ['الهوية الرقمية', 'التوقيع الإلكتروني', 'الدفع الإلكتروني', 'المتابعة الفورية']
                }
            },
            
            // Advanced pattern matching with context understanding
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
            
            // Generate contextual responses
            generateContextualResponse: (match, query) => {
                if (!match) return null;
                
                let response = match.response;
                
                // Add specific steps if query asks "how"
                if (query.includes('كيف') && match.steps) {
                    response += '\n\nالخطوات المطلوبة:\n';
                    match.steps.forEach((step, index) => {
                        response += `${index + 1}. ${step}\n`;
                    });
                }
                
                // Add requirements if query asks about documents
                if ((query.includes('مستند') || query.includes('وثائق')) && match.requirements) {
                    response += '\n\nالمستندات المطلوبة:\n';
                    match.requirements.forEach(req => {
                        response += `• ${req}\n`;
                    });
                }
                
                // Add benefits if query asks about benefits
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
        
        // Direct pattern match
        if (query.includes(pattern.toLowerCase())) {
            score += 0.9;
        }
        
        // Partial matches in pattern
        const patternWords = pattern.split(' ');
        patternWords.forEach(word => {
            if (query.includes(word.toLowerCase())) {
                score += 0.3;
            }
        });
        
        // Context matches in response and other fields
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
        // Enhanced government site knowledge with more detailed information
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
                },
                {
                    name: 'التأمينات الاجتماعية',
                    nameEn: 'Social Insurance',
                    url: '/social-insurance',
                    keywords: ['تأمينات اجتماعية', 'معاش', 'تقاعد', 'ساند', 'عجز', 'gosi'],
                    description: 'نظام التأمينات الاجتماعية الذي يوفر الحماية للعمال وأسرهم',
                    branches: ['تأمين الشيخوخة والعجز والوفاة', 'تأمين إصابات العمل', 'تأمين البطالة (ساند)'],
                    benefits: ['معاش شهري', 'مكافأة نهاية الخدمة', 'تعويض العجز', 'إعانة البطالة'],
                    category: 'تأمين'
                }
            ]
        });
        
        // Add more comprehensive data for other ministries...
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
                },
                {
                    name: 'خدمات التوثيق',
                    nameEn: 'Notarization Services',
                    url: '/notarization',
                    keywords: ['توثيق', 'كاتب عدل', 'عقد', 'وكالة', 'إقرار', 'notary'],
                    description: 'خدمات توثيق العقود والوكالات والإقرارات لدى كتاب العدل',
                    types: ['توثيق عقود البيع', 'توثيق الوكالات', 'توثيق الإقرارات', 'توثيق التنازل'],
                    requirements: ['هوية وطنية أو إقامة', 'المستندات الأصلية', 'حضور الأطراف'],
                    category: 'توثيق'
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
            
            // Step 3: AI-powered analysis (using modern models)
            const aiAnswer = await this.generateAdvancedAIAnswer(query, knowledgeResults, localAnalysis);
            
            // Step 4: Generate related questions
            const relatedQuestions = await this.generateRelatedQuestions({ query, results: knowledgeResults });
            
            const results = {
                aiAnswer,
                results: knowledgeResults,
                confidence: this.calculateAdvancedConfidence(query, knowledgeResults, localAnalysis),
                relatedQuestions,
                localAnalysis
            };
            
            this.searchCache.set(cacheKey, results);
            return results;
            
        } catch (error) {
            console.error('Advanced AI Search error:', error);
            return this.fallbackToLocalAI(query, context);
        }
    }
    
    async generateAdvancedAIAnswer(query, knowledgeResults, localAnalysis) {
        // Try HuggingFace models in order of preference
        const models = [
            this.aiConfig.models.arabic_qa, // Best for Arabic Q&A
            this.aiConfig.models.multilingual_qa, // Fallback multilingual
            this.aiConfig.models.instruction_following // General instruction following
        ];
        
        for (const model of models) {
            try {
                const answer = await this.callHuggingFaceModel(model, query, knowledgeResults, localAnalysis);
                if (answer && answer.length > 20) { // Ensure meaningful response
                    this.requestCount++;
                    return answer;
                }
            } catch (error) {
                console.error(`Model ${model} failed:`, error);
                continue;
            }
        }
        
        // Fallback to enhanced local processing
        return this.generateEnhancedLocalAnswer(query, knowledgeResults, localAnalysis);
    }
    
    async callHuggingFaceModel(model, query, knowledgeResults, localAnalysis) {
        if (!this.aiConfig.huggingFaceToken || this.aiConfig.huggingFaceToken === 'hf_your_existing_token_here') {
            throw new Error('HuggingFace token not configured');
        }
        
        const cacheKey = `hf_${model}_${query}`;
        if (this.aiCache.has(cacheKey)) {
            return this.aiCache.get(cacheKey);
        }
        
        // Prepare context from multiple sources
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
        
        let requestBody;
        
        if (model.includes('arabic') || model.includes('arabert')) {
            // Arabic-specific models
            requestBody = {
                inputs: {
                    question: query,
                    context: context
                },
                options: { 
                    wait_for_model: true,
                    use_cache: true
                }
            };
        } else if (model.includes('flan-t5')) {
            // Instruction-following model
            requestBody = {
                inputs: `اجب على السؤال التالي باللغة العربية بناءً على المعلومات المتاحة:\n\nالسؤال: ${query}\n\nالمعلومات: ${context}\n\nالإجابة:`,
                parameters: {
                    max_length: 500,
                    temperature: 0.7,
                    do_sample: true
                },
                options: { 
                    wait_for_model: true,
                    use_cache: true
                }
            };
        } else {
            // Standard Q&A models
            requestBody = {
                inputs: {
                    question: query,
                    context: context
                },
                options: { 
                    wait_for_model: true,
                    use_cache: true
                }
            };
        }
        
        const response = await fetch(`${this.aiConfig.apiEndpoint}${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.aiConfig.huggingFaceToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('Model loading, please try again');
            }
            throw new Error(`HuggingFace API error: ${response.status}`);
        }
        
        const data = await response.json();
        let answer;
        
        if (Array.isArray(data)) {
            answer = data[0]?.generated_text || data[0]?.answer;
        } else {
            answer = data.answer || data.generated_text;
        }
        
        if (answer) {
            // Clean up the answer
            answer = this.cleanAIResponse(answer, query);
            this.aiCache.set(cacheKey, answer);
            return answer;
        }
        
        return null;
    }
    
    cleanAIResponse(answer, originalQuery) {
        // Remove repetitive content
        answer = answer.replace(new RegExp(originalQuery, 'gi'), '');
        
        // Remove common prefixes/suffixes
        answer = answer.replace(/^(الإجابة:|Answer:|اجب:|إجابة:)/i, '').trim();
        answer = answer.replace(/\n\n+/g, '\n\n'); // Clean multiple newlines
        
        // Limit length to reasonable size
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
    
    async generateRelatedQuestions(context) {
        try {
            if (!this.aiConfig.huggingFaceToken) {
                return this.generateLocalRelatedQuestions(context);
            }
            
            const model = this.aiConfig.models.question_generation;
            const sourceText = context.query + ' ' + (context.results || []).map(r => r.snippet).join(' ');
            
            const response = await fetch(`${this.aiConfig.apiEndpoint}${model}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.aiConfig.huggingFaceToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: sourceText.substring(0, 500), // Limit input length
                    options: { wait_for_model: true }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.parseGeneratedQuestions(data);
            }
        } catch (error) {
            console.error('Question generation error:', error);
        }
        
        return this.generateLocalRelatedQuestions(context);
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
    
    parseGeneratedQuestions(data) {
        // Parse AI-generated questions
        if (Array.isArray(data) && data[0]?.generated_text) {
            const questions = data[0].generated_text
                .split(/[.؟?]/)
                .filter(q => q.trim().length > 5)
                .map(q => q.trim() + '؟')
                .slice(0, 4);
            return questions;
        }
        return [];
    }
    
    async searchEnhancedKnowledgeBase(query, context) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        // Search with enhanced scoring
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
        
        // Search all sites if not enough results from current site
        if (results.length < 5 && context.currentSite) {
            for (const [domain, siteData] of this.govSiteData.entries()) {
                if (domain === context.currentSite) continue;
                
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
        }
        
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 8);
    }
    
    calculateEnhancedRelevance(query, service) {
        let score = 0;
        const queryWords = query.split(/\s+/).filter(word => word.length > 1);
        
        // Enhanced keyword matching with weights
        service.keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            if (query.includes(keywordLower)) {
                score += 0.8; // High score for exact keyword match
            }
            
            queryWords.forEach(word => {
                if (keywordLower.includes(word)) {
                    score += 0.4; // Medium score for partial match
                }
            });
        });
        
        // Name and description matching
        const searchableText = `${service.name} ${service.nameEn || ''} ${service.description}`.toLowerCase();
        queryWords.forEach(word => {
            if (searchableText.includes(word)) {
                score += 0.3;
            }
        });
        
        // Category matching
        if (service.category && query.includes(service.category)) {
            score += 0.5;
        }
        
        // Requirements and steps matching (for "how to" queries)
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
        let confidence = 40; // Lower base confidence
        
        // Boost for local analysis match
        if (localAnalysis && localAnalysis.score > 0.7) {
            confidence += 30;
        }
        
        // Boost for knowledge base results
        if (knowledgeResults.length > 0) {
            confidence += Math.min(knowledgeResults.length * 8, 25);
            
            const avgRelevance = knowledgeResults.reduce((sum, r) => sum + (r.relevance || 0.5), 0) / knowledgeResults.length;
            confidence += avgRelevance * 20;
        }
        
        // Boost for Arabic-specific queries (our strength)
        if (this.isArabicQuery(query)) {
            confidence += 10;
        }
        
        // Boost for government-domain queries
        if (this.isGovernmentQuery(query)) {
            confidence += 15;
        }
        
        return Math.min(Math.round(confidence), 92); // Cap at 92%
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
        if (!this.aiConfig.huggingFaceToken || this.aiConfig.huggingFaceToken === 'hf_your_existing_token_here') {
            return {
                status: 'no_token',
                message: 'HuggingFace token not configured',
                models_available: false
            };
        }
        
        try {
            // Test the primary Arabic model
            const response = await fetch(`${this.aiConfig.apiEndpoint}${this.aiConfig.models.arabic_qa}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.aiConfig.huggingFaceToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: { question: 'test', context: 'test' },
                    options: { wait_for_model: false }
                })
            });
            
            return {
                status: response.ok ? 'ready' : 'loading',
                message: response.ok ? 'AI services ready' : 'AI models loading',
                models_available: true,
                rate_limit_remaining: this.maxRequestsPerHour - this.requestCount
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                models_available: false
            };
        }
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
            source: 'local_ai'
        };
    }
    
    // Rate limiting and cache management
    checkRateLimit() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        if (!this.lastReset || now - this.lastReset > oneHour) {
            this.requestCount = 0;
            this.lastReset = now;
        }
        
        return this.requestCount < this.maxRequestsPerHour;
    }
    
    clearCache() {
        // Clear old cache entries (older than 1 hour)
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
    
    // Periodic cache cleanup
    startCacheCleanup() {
        setInterval(() => {
            this.clearCache();
        }, 30 * 60 * 1000); // Every 30 minutes
    }
}

// Initialize the enhanced AI engine with automatic cache management
const digitalGuideAI = new DigitalGuideAI();
digitalGuideAI.startCacheCleanup();
