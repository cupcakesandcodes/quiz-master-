const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dir = 'C:\\Users\\Arya Verma\\.gemini\\antigravity\\brain\\28a8e923-1b47-4a51-8218-c8bef20143bd';
const apiKey = process.env.OPENROUTER_API_KEY || '';

async function classify() {
    const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('media__17761035'))
        .sort();

    for (const file of files) {
        const filePath = path.join(dir, file);
        const base64Image = fs.readFileSync(filePath).toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        try {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: 'openai/gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Which of the following is this a screenshot of: "landing_page", "my_quizzes", "create_build", "quiz_builder", "player_join", "host_monitoring", "player_question". Answer strictly with one of these exact keys.' },
                            { type: 'image_url', image_url: { url: dataUrl } }
                        ]
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`${file} = ${response.data.choices[0].message.content}`);
        } catch (e) {
            console.error(file, e.message);
        }
    }
}
classify();
