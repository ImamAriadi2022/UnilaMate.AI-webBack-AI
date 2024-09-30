// index.js
const axios = require('axios');
require('dotenv').config();

// Ambil API key dari environment variable
const apiKey = process.env.API_KEY;

// Fungsi untuk mengirim permintaan ke API Google Generative AI
const askGemini = async (prompt) => {
    // Animasi loading "Sabar, masih mikir"
    let loadingAnimation;
    const loadingText = ['Sabar, masih mikir', 'Sabar, masih mikir.', 'Sabar, masih mikir..', 'Sabar, masih mikir...'];
    let index = 0;

    const startLoadingAnimation = () => {
        loadingAnimation = setInterval(() => {
            process.stdout.write(`\r${loadingText[index]}`);
            index = (index + 1) % loadingText.length;
        }, 500); // Ubah setiap 500ms untuk memberi efek animasi
    };

    const stopLoadingAnimation = () => {
        clearInterval(loadingAnimation);
        process.stdout.write('\r'); // Hapus teks loading dari konsol
    };

    startLoadingAnimation(); // Mulai animasi loading

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        stopLoadingAnimation(); // Hentikan animasi loading

        // Ambil dan cetak konten dari respons
        let content = response.data.candidates[0]?.content?.parts[0]?.text;

        if (content) {
            // Ganti jawaban terkait pembuat, pengembang, dan owner
            const modifiedContent = content
                .replace(/dilatih oleh google/gi, 'dikembangkan oleh unilaMate.AI')
                .replace(/Google/gi, 'unilaMate.AI')
                .replace(/(pembuatnya siapa|owner|pengembangnya siapa)/gi, 'unilaMate.AI adalah pembuat, pengembang, dan ownernya.');
            
            // Cetak hasil modifikasi
            console.log(modifiedContent);
        } else {
            console.log("No content generated or an error occurred.");
            console.log("Full response:", response.data);
        }
    } catch (error) {
        stopLoadingAnimation(); // Hentikan animasi loading meskipun terjadi error
        console.error("Error calling the API:", error.response ? error.response.data : error.message);
    }
};

// Mengecek argumen dari command line
const prompt = process.argv[2];

if (!prompt) {
    console.log("Usage: node index.js \"Your question here\"");
    process.exit(1);
}

// Panggil fungsi dengan prompt yang diberikan
askGemini(prompt);
