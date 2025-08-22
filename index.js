import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { franc } from 'franc'; // Gunakan import untuk franc
import fs from 'fs';
import path from 'path';

dotenv.config();// Tambahkan library franc untuk deteksi bahasa

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('test')); // Serve static files dari folder test

const groqApiKey = process.env.GROQ_API_KEY;

// Load FAQ data
let faqData;
try {
    const faqPath = path.join(process.cwd(), 'faq.json');
    console.log('Loading FAQ from:', faqPath);
    const rawData = fs.readFileSync(faqPath, 'utf8');
    console.log('Raw FAQ data length:', rawData.length);
    faqData = JSON.parse(rawData);
    console.log('FAQ loaded successfully. FAQ count:', faqData.faq ? faqData.faq.length : 0);
} catch (error) {
    console.error('Error loading FAQ data:', error);
    faqData = { faq: [], website_info: { name: 'UnilaMate.AI', description: 'Platform AI', features: [], contact: {} } };
}

// Fungsi untuk mendeteksi bahasa
function detectLanguage(prompt) {
    const langCode = franc(prompt);
    console.log(`Kode bahasa dari franc: ${langCode}`);
    
    // Mapping kode bahasa franc ke bahasa yang lebih mudah dibaca
    const languageMap = {
        'eng': 'english',
        'ind': 'indonesian', 
        'spa': 'spanish',
        'fra': 'french',
        'deu': 'german',
        'ita': 'italian',
        'por': 'portuguese',
        'rus': 'russian',
        'jpn': 'japanese',
        'kor': 'korean',
        'zho': 'chinese'
    };
    
    // Jika bahasa tidak dikenali atau terlalu pendek, coba deteksi manual untuk bahasa Indonesia
    if (langCode === 'und' || prompt.length < 10) {
        const indonesianWords = ['saya', 'anda', 'yang', 'adalah', 'dengan', 'untuk', 'dari', 'ini', 'itu', 'dan', 'atau', 'jika', 'akan', 'sudah', 'belum', 'bisa', 'dapat', 'halo', 'selamat', 'terima', 'kasih', 'maaf', 'permisi'];
        const words = prompt.toLowerCase().split(/\s+/);
        const indonesianWordCount = words.filter(word => indonesianWords.includes(word)).length;
        
        if (indonesianWordCount > 0) {
            return 'indonesian';
        }
    }
    
    return languageMap[langCode] || 'english'; // Default ke english
}

// Fungsi untuk menghitung similarity antara dua string
function calculateSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
}

// Fungsi untuk menganalisis intent dari pertanyaan
function analyzeIntent(prompt) {
    const normalizedPrompt = prompt.toLowerCase();
    
    const intents = {
        greeting: ['halo', 'hai', 'hello', 'selamat', 'apa kabar'],
        what_is: ['apa itu', 'what is', 'jelaskan', 'definisi', 'pengertian'],
        how_to: ['bagaimana', 'cara', 'how to', 'gimana', 'langkah'],
        pricing: ['harga', 'biaya', 'gratis', 'free', 'bayar', 'paket', 'premium'],
        contact: ['kontak', 'hubungi', 'support', 'bantuan', 'email', 'telepon'],
        features: ['fitur', 'fungsi', 'feature', 'kemampuan', 'bisa apa'],
        language: ['bahasa', 'language', 'indonesia', 'english', 'support'],
        workflow: ['alur', 'kerja', 'workflow', 'proses', 'tahapan']
    };
    
    let detectedIntent = 'general';
    let maxMatches = 0;
    
    Object.keys(intents).forEach(intent => {
        const matches = intents[intent].filter(keyword => 
            normalizedPrompt.includes(keyword)
        ).length;
        
        if (matches > maxMatches) {
            maxMatches = matches;
            detectedIntent = intent;
        }
    });
    
    return { intent: detectedIntent, confidence: maxMatches };
}

// Fungsi untuk mencari FAQ yang relevan (ditingkatkan)
function findRelevantFAQ(prompt) {
    const normalizedPrompt = prompt.toLowerCase();
    const intent = analyzeIntent(prompt);
    const relevantFAQs = [];
    
    faqData.faq.forEach(faq => {
        let relevanceScore = 0;
        
        // 1. Keyword matching (bobot tinggi)
        faq.keywords.forEach(keyword => {
            if (normalizedPrompt.includes(keyword.toLowerCase())) {
                relevanceScore += 3;
            }
        });
        
        // 2. Similarity dengan pertanyaan (bobot sedang)
        const similarity = calculateSimilarity(prompt, faq.question);
        relevanceScore += similarity * 5;
        
        // 3. Similarity dengan jawaban (bobot rendah)
        const answerSimilarity = calculateSimilarity(prompt, faq.answer);
        relevanceScore += answerSimilarity * 2;
        
        // 4. Intent matching bonus
        const faqText = (faq.question + ' ' + faq.answer).toLowerCase();
        if (intent.intent === 'what_is' && faqText.includes('apa itu')) {
            relevanceScore += 2;
        } else if (intent.intent === 'how_to' && faqText.includes('cara')) {
            relevanceScore += 2;
        } else if (intent.intent === 'pricing' && faqText.includes('gratis')) {
            relevanceScore += 2;
        }
        
        // 5. Exact phrase matching (bobot tertinggi)
        const promptPhrases = prompt.toLowerCase().split(' ').filter(word => word.length > 2);
        promptPhrases.forEach(phrase => {
            if (faq.question.toLowerCase().includes(phrase)) {
                relevanceScore += 4;
            }
        });
        
        if (relevanceScore > 0.5) { // Threshold lebih rendah untuk menangkap lebih banyak relevansi
            relevantFAQs.push({ ...faq, relevanceScore, intent: intent.intent });
        }
    });
    
    // Sort by relevance score
    return relevantFAQs.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
}

// Fungsi untuk membuat context dari FAQ (ditingkatkan)
function createFAQContext(prompt) {
    const relevantFAQs = findRelevantFAQ(prompt);
    const intent = analyzeIntent(prompt);
    
    let contextIntro = '';
    
    // Personalisasi intro berdasarkan intent
    switch(intent.intent) {
        case 'greeting':
            contextIntro = `Halo! Saya adalah asisten AI untuk ${faqData.website_info.name}. Saya siap membantu Anda!`;
            break;
        case 'what_is':
            contextIntro = `Berikut informasi tentang ${faqData.website_info.name}:`;
            break;
        case 'how_to':
            contextIntro = `Saya akan membantu Anda dengan langkah-langkah penggunaan ${faqData.website_info.name}:`;
            break;
        case 'pricing':
            contextIntro = `Berikut informasi tentang harga dan paket ${faqData.website_info.name}:`;
            break;
        case 'contact':
            contextIntro = `Berikut cara menghubungi tim ${faqData.website_info.name}:`;
            break;
        default:
            contextIntro = `Berdasarkan FAQ ${faqData.website_info.name}:`;
    }
    
    if (relevantFAQs.length === 0) {
        return `
${contextIntro}

${faqData.website_info.description}

Fitur utama kami:
${faqData.website_info.features.map(f => `• ${f}`).join('\n')}

Kontak:
• Email: ${faqData.website_info.contact.email}
• Website: ${faqData.website_info.contact.website}

Jika Anda memiliki pertanyaan spesifik, silakan tanyakan dan saya akan membantu berdasarkan pengetahuan saya.
        `.trim();
    }
    
    const faqContext = relevantFAQs.map((faq, index) => 
        `${index + 1}. Q: ${faq.question}
   A: ${faq.answer}
   (Relevance: ${faq.relevanceScore.toFixed(1)})`
    ).join('\n\n');
    
    return `
${contextIntro}

FAQ yang relevan:
${faqContext}

Informasi tambahan:
• ${faqData.website_info.description}
• Kontak: ${faqData.website_info.contact.email}
• Website: ${faqData.website_info.contact.website}

Fitur utama:
${faqData.website_info.features.map(f => `• ${f}`).join('\n')}
    `.trim();
}

// CLI Mode - jika ada argumen command line
async function handleCLI() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const prompt = args.join(' ');
        console.log(`Mengirim prompt: "${prompt}"`);

        if (!groqApiKey) {
            console.error('Error: GROQ_API_KEY tidak ditemukan di .env file');
            console.error('Dapatkan API key di: https://console.groq.com/');
            process.exit(1);
        }

        const language = detectLanguage(prompt);
        console.log(`Bahasa terdeteksi: ${language}`);

        // Generate context dari FAQ
        const faqContext = createFAQContext(prompt);
        const intent = analyzeIntent(prompt);
        console.log(`Intent terdeteksi: ${intent.intent} (confidence: ${intent.confidence})`);
        console.log(`FAQ Context: ${faqContext.substring(0, 150)}...`);

        try {
            console.log('Mengirim request ke Groq API...');
            
            const systemPrompt = language === 'indonesian' 
                ? `Anda adalah asisten AI yang sangat pintar dan membantu untuk ${faqData.website_info.name}. 

INSTRUKSI PENTING:
1. Jawab SELALU dalam bahasa Indonesia yang natural dan mudah dipahami
2. Prioritaskan informasi dari FAQ context yang disediakan
3. Jika pertanyaan ada dalam FAQ, jawab berdasarkan FAQ tersebut
4. Jika tidak ada dalam FAQ, berikan jawaban umum yang membantu dan relevan
5. Selalu bersikap ramah, profesional, dan solution-oriented
6. Jika diminta menjelaskan workflow/alur kerja, berikan penjelasan step-by-step yang detail
7. Gunakan emoji yang sesuai untuk membuat jawaban lebih menarik
8. Akhiri dengan pertanyaan atau ajakan untuk bertanya lebih lanjut

Context yang tersedia:
${faqContext}

Intent user: ${intent.intent}
Confidence: ${intent.confidence}`
                : `You are a very smart and helpful AI assistant for ${faqData.website_info.name}.

IMPORTANT INSTRUCTIONS:
1. Always answer in ${language} naturally and clearly
2. Prioritize information from the provided FAQ context
3. If the question is in the FAQ, answer based on that FAQ
4. If not in FAQ, provide helpful and relevant general answers
5. Always be friendly, professional, and solution-oriented
6. If asked about workflow, provide detailed step-by-step explanations
7. Use appropriate emojis to make answers more engaging
8. End with a question or invitation to ask more

Available context:
${faqContext}

User intent: ${intent.intent}
Confidence: ${intent.confidence}`;

            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: "llama3-8b-8192",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000
                }
            );

            const content = response.data.choices[0]?.message?.content;

            if (content) {
                console.log('\n=== Jawaban AI ===');
                console.log(content);
            } else {
                console.error('Error: AI tidak menghasilkan respons.');
            }
        } catch (error) {
            if (error.response?.status === 429) {
                console.error('\n❌ Error 429: Rate limit terlampaui');
                console.error('💡 Solusi: Tunggu beberapa saat sebelum mencoba lagi');
            } else if (error.response?.status === 401) {
                console.error('❌ Error 401: API key tidak valid');
                console.error('💡 Periksa GROQ_API_KEY di file .env');
            } else if (error.response?.status === 403) {
                console.error('❌ Error 403: Akses ditolak');
            } else {
                console.error('❌ Error:', error.response?.data || error.message);
            }
        }

        return true; // CLI mode digunakan
    }
    return false; // Tidak ada argumen CLI
}

// API endpoint untuk server mode
app.post('/api/ask-ai', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!groqApiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    const language = detectLanguage(prompt);
    console.log(`Bahasa terdeteksi: ${language}`);

    // Generate context dari FAQ
    const faqContext = createFAQContext(prompt);
    const intent = analyzeIntent(prompt);

    try {
        const systemPrompt = language === 'indonesian' 
            ? `Anda adalah asisten AI yang sangat pintar dan membantu untuk ${faqData.website_info.name}.

INSTRUKSI PENTING:
1. Jawab SELALU dalam bahasa Indonesia yang natural dan mudah dipahami
2. Prioritaskan informasi dari FAQ context yang disediakan
3. Jika pertanyaan ada dalam FAQ, jawab berdasarkan FAQ tersebut
4. Jika tidak ada dalam FAQ, berikan jawaban umum yang membantu dan relevan
5. Selalu bersikap ramah, profesional, dan solution-oriented
6. Jika diminta menjelaskan workflow/alur kerja, berikan penjelasan step-by-step yang detail
7. Gunakan emoji yang sesuai untuk membuat jawaban lebih menarik
8. Akhiri dengan pertanyaan atau ajakan untuk bertanya lebih lanjut

Context yang tersedia:
${faqContext}

Intent user: ${intent.intent}
Confidence: ${intent.confidence}`
            : `You are a very smart and helpful AI assistant for ${faqData.website_info.name}.

IMPORTANT INSTRUCTIONS:
1. Always answer in ${language} naturally and clearly
2. Prioritize information from the provided FAQ context
3. If the question is in the FAQ, answer based on that FAQ
4. If not in FAQ, provide helpful and relevant general answers
5. Always be friendly, professional, and solution-oriented
6. If asked about workflow, provide detailed step-by-step explanations
7. Use appropriate emojis to make answers more engaging
8. End with a question or invitation to ask more

Available context:
${faqContext}

User intent: ${intent.intent}
Confidence: ${intent.confidence}`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const content = response.data.choices[0]?.message?.content;

        if (content) {
            res.json({ answer: content });
        } else {
            res.status(500).json({ error: 'AI response not generated.' });
        }
    } catch (error) {
        console.error('Groq API Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error processing the AI request',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint untuk mendapatkan semua FAQ
app.get('/api/faq', (req, res) => {
    console.log('GET /api/faq endpoint called');
    console.log('faqData:', faqData ? 'exists' : 'null');
    
    try {
        if (!faqData) {
            console.error('faqData is null');
            return res.status(500).json({ error: 'FAQ data not loaded' });
        }
        
        console.log('Sending FAQ data, faq count:', faqData.faq ? faqData.faq.length : 0);
        res.json(faqData);
    } catch (error) {
        console.error('Error in /api/faq endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint untuk mencari FAQ
app.get('/api/faq/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const relevantFAQs = findRelevantFAQ(q);
    res.json({ 
        query: q,
        results: relevantFAQs,
        total: relevantFAQs.length 
    });
});

// Endpoint untuk menambah FAQ baru
app.post('/api/faq', (req, res) => {
    const { question, answer, keywords } = req.body;
    
    if (!question || !answer) {
        return res.status(400).json({ error: 'Question and answer are required' });
    }
    
    const newId = Math.max(...faqData.faq.map(f => f.id), 0) + 1;
    const newFAQ = {
        id: newId,
        question,
        answer,
        keywords: keywords || []
    };
    
    faqData.faq.push(newFAQ);
    
    // Save to file
    try {
        const faqPath = path.join(process.cwd(), 'faq.json');
        fs.writeFileSync(faqPath, JSON.stringify(faqData, null, 2));
        res.json({ message: 'FAQ added successfully', faq: newFAQ });
    } catch (error) {
        console.error('Error saving FAQ:', error);
        res.status(500).json({ error: 'Failed to save FAQ' });
    }
});

// Endpoint untuk update FAQ
app.put('/api/faq/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { question, answer, keywords } = req.body;
    
    const faqIndex = faqData.faq.findIndex(f => f.id === id);
    
    if (faqIndex === -1) {
        return res.status(404).json({ error: 'FAQ not found' });
    }
    
    if (question) faqData.faq[faqIndex].question = question;
    if (answer) faqData.faq[faqIndex].answer = answer;
    if (keywords) faqData.faq[faqIndex].keywords = keywords;
    
    // Save to file
    try {
        const faqPath = path.join(process.cwd(), 'faq.json');
        fs.writeFileSync(faqPath, JSON.stringify(faqData, null, 2));
        res.json({ message: 'FAQ updated successfully', faq: faqData.faq[faqIndex] });
    } catch (error) {
        console.error('Error saving FAQ:', error);
        res.status(500).json({ error: 'Failed to save FAQ' });
    }
});

// Endpoint untuk hapus FAQ
app.delete('/api/faq/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const faqIndex = faqData.faq.findIndex(f => f.id === id);
    
    if (faqIndex === -1) {
        return res.status(404).json({ error: 'FAQ not found' });
    }
    
    const deletedFAQ = faqData.faq.splice(faqIndex, 1)[0];
    
    // Save to file
    try {
        const faqPath = path.join(process.cwd(), 'faq.json');
        fs.writeFileSync(faqPath, JSON.stringify(faqData, null, 2));
        res.json({ message: 'FAQ deleted successfully', faq: deletedFAQ });
    } catch (error) {
        console.error('Error saving FAQ:', error);
        res.status(500).json({ error: 'Failed to save FAQ' });
    }
});

const PORT = process.env.PORT || 3000;

// Jalankan CLI mode jika ada argumen, atau server mode jika tidak
async function main() {
    const isCliMode = await handleCLI();

    if (!isCliMode) {
        // Server mode
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log('📝 Gunakan: node index.js "your question" untuk CLI mode');
            console.log('🌐 Atau kirim POST request ke /api/ask-ai untuk server mode');
            console.log('🔑 Menggunakan Groq API dengan model llama3-8b-8192');
        });
    }
}

main().catch(console.error);