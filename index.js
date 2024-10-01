// index.js
const axios = require('axios');
require('dotenv').config();

// Ambil API key dari environment variable
const apiKey = process.env.API_KEY;

// Fungsi untuk membungkus teks per baris (word wrapping)
const wrapText = (text, maxLineLength) => {
    let wrappedText = '';
    let line = '';
    
    text.split(' ').forEach((word) => {
        if ((line + word).length > maxLineLength) {
            wrappedText += line.trim() + '\n'; // Tambahkan baris yang sudah penuh
            line = ''; // Reset line untuk baris berikutnya
        }
        line += word + ' '; // Tambahkan kata ke baris
    });

    // Tambahkan baris terakhir yang mungkin belum penuh
    if (line.length > 0) {
        wrappedText += line.trim();
    }

    return wrappedText;
};

// Fungsi untuk menampilkan animasi mengetik
const typeAnimation = (text) => {
    let index = 0;
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            process.stdout.write(text.charAt(index));
            index++;
            if (index === text.length) {
                clearInterval(interval);
                resolve(); // Selesai mengetik
            }
        }, 10); // Kecepatan mengetik
    });
};

// Fungsi untuk mengirim permintaan ke API Google Generative AI
const askGemini = async (prompt) => {
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

        // Ambil dan cetak konten dari respons
        let content = response.data.candidates[0]?.content?.parts[0]?.text;

        if (content) {
            // Ganti jawaban terkait pembuat, pengembang, dan owner
            const modifiedContent = content
                .replace(/dilatih oleh google/gi, 'dikembangkan oleh imam ariadi')
                .replace(/Google/gi, 'imam ariadi')
                .replace(/(pembuatnya siapa|owner|pengembangnya siapa)/gi, 'imam ariadi adalah pembuat, pengembang, dan ownernya.');

            // Bungkus teks agar rapi di console (80 karakter per baris)
            const wrappedContent = wrapText(modifiedContent, 50);

            // Cetak hasil modifikasi dengan animasi mengetik
            await typeAnimation(wrappedContent);
            console.log(); // Menambah newline setelah animasi selesai
        } else {
            console.log("No content generated or an error occurred.");
            console.log("Full response:", response.data);
        }
    } catch (error) {
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
