require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getTranscript } = require('./scraper');
const { summarizeTranscript } = require('./summarizer');
const openai = require('./openai');  // Use the shared instance

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/transcript', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const transcript = await getTranscript(url);
        console.log('Got transcript, length:', transcript.length);

        const plainText = transcript
            .map(segment => segment.text)
            .join(' ');
        console.log('Plain text length:', plainText.length);
        
        const summary = await summarizeTranscript(plainText);
        console.log('Generated summary:', summary);

        res.json({ 
            success: true, 
            summary,
            transcript: plainText
        });
    } catch (error) {
        console.error('Detailed error:', error);
        if (error.message.includes('transcript')) {
            res.status(404).json({ 
                error: 'No transcript available for this video' 
            });
        } else if (error.message.includes('quota')) {
            res.status(429).json({ 
                error: 'API rate limit exceeded' 
            });
        } else {
            res.status(500).json({ 
                error: 'An unexpected error occurred' 
            });
        }
    }
});

app.post('/api/question', async (req, res) => {
    try {
        const { question, transcript } = req.body;
        
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that answers questions about video transcripts. Use the provided transcript as context for your answers."
                },
                {
                    role: "user",
                    content: `Using this transcript as context:\n\n${transcript}\n\nPlease answer this question: ${question}`
                }
            ],
            max_tokens: parseInt(process.env.MAX_TOKENS) || 500
        });

        res.json({ 
            success: true, 
            answer: response.choices[0].message.content 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 