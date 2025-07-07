const { chromium } = require('@playwright/test');
const fs = require('fs');

async function getTranscript(url) {
    console.log('Launching browser in headless mode...');
    const browser = await chromium.launch({
        headless: true,
    });
    let page;
    
    try {
        page = await browser.newPage();
        console.log('Navigating to page...');
        await page.goto(url);
        
        // Wait for video to load
        await page.waitForTimeout(2000);
        
        console.log('Looking for More button...');
        const moreButton = await page.waitForSelector(
            'tp-yt-paper-button#expand.style-scope.ytd-text-inline-expander[role="button"]',
            { 
                state: 'visible',
                timeout: 5000 
            }
        );
        
        await moreButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        console.log('Clicking More button...');
        await moreButton.click();
        
        // Wait longer after clicking More
        await page.waitForTimeout(2000);
        
        console.log('Looking for Show transcript button...');
        const transcriptButton = await page.waitForSelector(
            'button.yt-spec-button-shape-next.yt-spec-button-shape-next--outline.yt-spec-button-shape-next--call-to-action.yt-spec-button-shape-next--size-m[aria-label="Show transcript"]',
            { 
                state: 'visible',
                timeout: 5000 
            }
        );
        
        console.log('Found transcript button, clicking...');
        await transcriptButton.click();
        
        console.log('Waiting for transcript panel...');
        await page.waitForTimeout(2000);

        // Get segments
        const segments = await page.$$eval(
            'ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer',
            segments => segments.map(segment => {
                const timestamp = segment.querySelector('div.segment-timestamp')?.textContent?.trim() || '';
                const text = segment.querySelector('yt-formatted-string.segment-text')?.textContent?.trim() || '';
                return { timestamp, text };
            })
        );

        // Save the transcript to a file
        const output = {
            videoUrl: url,
            extractedAt: new Date().toISOString(),
            segments: segments
        };

        fs.writeFileSync('transcript.json', JSON.stringify(output, null, 2));
        console.log('Transcript saved to transcript.json');
        
        // Also save a plain text version
        const plainText = segments
            .map(segment => `[${segment.timestamp}] ${segment.text}`)
            .join('\n');
        fs.writeFileSync('transcript.txt', plainText);
        console.log('Plain text transcript saved to transcript.txt');

        return segments;
        
    } catch (error) {
        console.error('Error:', error);
        if (page) {
            const content = await page.content();
            fs.writeFileSync('page-content-error.html', content);
            console.log('Page content at time of error saved to page-content-error.html');
        }
        throw error;
    } finally {
        await browser.close();
    }
}

// Add cleanup for temporary files
function cleanupFiles() {
    const filesToClean = [
        'transcript.txt',
        'transcript.json',
        'transcript-debug.json'
    ];
    
    filesToClean.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });
}

module.exports = { getTranscript };

// Remove or comment out the test call
// const testUrl = 'https://www.youtube.com/watch?v=gYqs-wUKZsM';
// getTranscript(testUrl)
//     .then(transcript => console.log('Successfully extracted transcript'))
//     .catch(error => console.error('Failed:', error)); 