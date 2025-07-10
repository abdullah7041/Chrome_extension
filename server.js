require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Add a test endpoint to verify server is working
app.get('/', (req, res) => {
  res.json({ message: 'MusAid Backend is running!' });
});

// Debug endpoint to check environment variables
app.get('/debug', (req, res) => {
  res.json({ 
    apiKeyExists: !!process.env.OPENAI_API_KEY,
    apiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

app.post('/ask', async (req, res) => {
  const { message } = req.body;

  // Validate input
  if (!message) {
    return res.status(400).json({ error: 'رسالة مطلوبة' });
  }

  const prompt = `أنت مساعد ذكي متخصص في مساعدة المستخدمين على فهم وتصفح المواقع الحكومية السعودية. أجب بشكل بسيط وواضح، واذكر الخطوات والروابط إن أمكن.\n\nسؤال المستخدم: ${message}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ reply: response.data.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI ERROR:", error.response?.data || error.message);
    
    // Send detailed error info for debugging
    const errorMessage = error.response?.data?.error?.message || error.message || 'خطأ غير معروف';
    const statusCode = error.response?.status || 500;
    
    res.status(statusCode).json({ 
      error: 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي',
      details: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Use PORT environment variable (required for Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
  console.log(`🟢 Environment: ${process.env.NODE_ENV || 'development'}`);
});