const express = require('express');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Agar bisa diakses oleh frontend yang berbeda origin

const apiKey = process.env.API_KEY;

app.post('/api/ask-ai', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

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

        const content = response.data.candidates[0]?.content?.parts[0]?.text;

        if (content) {
            res.json({ answer: content });
        } else {
            res.status(500).json({ error: 'AI response not generated.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error processing the AI request' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
