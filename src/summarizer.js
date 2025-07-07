const openai = require('./openai');  // Use the shared instance

function chunkText(text, maxTokens = 3000) {
    if (!text || text.length === 0) {
        console.error('Empty text provided to chunkText');
        return [];
    }

    // Estimate total tokens (rough estimation: 1 token per 4 characters)
    const estimatedTokens = text.length / 4;
    console.log('Estimated tokens:', estimatedTokens);

    // If text is small enough, return it as a single chunk
    if (estimatedTokens <= maxTokens) {
        console.log('Text is small enough, no chunking needed');
        return [text];
    }

    console.log('Text needs chunking, splitting into smaller pieces...');
    
    // Split text into smaller pieces
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const word of words) {
        const tokenCount = word.length / 4; // Estimate tokens
        
        if (currentLength + tokenCount > maxTokens) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [word];
                currentLength = tokenCount;
            }
        } else {
            currentChunk.push(word);
            currentLength += tokenCount;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    console.log(`Split into ${chunks.length} chunks`);
    return chunks;
}

async function summarizeTranscript(text) {
    try {
        console.log('Starting summarization of text length:', text.length);
        const chunks = chunkText(text);
        console.log('Split into', chunks.length, 'chunks');

        if (chunks.length === 0) {
            console.error('No chunks created from text');
            return 'Unable to generate summary - no text chunks created';
        }

        let summaries = [];

        // Summarize each chunk
        for (const chunk of chunks) {
            console.log('Processing chunk of length:', chunk.length);
            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that summarizes video transcripts concisely. Focus on key points and main ideas."
                    },
                    {
                        role: "user",
                        content: `Please summarize this part of the transcript:\n\n${chunk}`
                    }
                ],
                max_tokens: parseInt(process.env.MAX_TOKENS) || 500
            });
            
            const summary = response.choices[0].message.content;
            console.log('Chunk summary:', summary);
            summaries.push(summary);
        }

        console.log('Number of summaries:', summaries.length);

        // If we have multiple summaries, combine them in batches
        if (summaries.length > 1) {
            console.log('Combining summaries in batches');
            while (summaries.length > 1) {
                const batchedSummaries = [];
                // Process summaries in batches of 3
                for (let i = 0; i < summaries.length; i += 3) {
                    const batch = summaries.slice(i, i + 3);
                    if (batch.length > 1) {
                        const combinedResponse = await openai.chat.completions.create({
                            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
                            messages: [
                                {
                                    role: "system",
                                    content: "You are a helpful assistant that combines multiple summary segments into one coherent summary."
                                },
                                {
                                    role: "user",
                                    content: `Please combine these summaries into one coherent summary:\n\n${batch.join('\n\n')}`
                                }
                            ],
                            max_tokens: parseInt(process.env.MAX_TOKENS) || 500
                        });
                        batchedSummaries.push(combinedResponse.choices[0].message.content);
                    } else {
                        batchedSummaries.push(batch[0]);
                    }
                }
                summaries = batchedSummaries;
                console.log('Reduced to', summaries.length, 'summaries');
            }
        }

        if (summaries.length === 0) {
            console.error('No summaries generated');
            return 'Unable to generate summary - no summaries created';
        }

        return summaries[0];
    } catch (error) {
        console.error('Summarization error:', error);
        throw error;
    }
}

module.exports = { summarizeTranscript }; 