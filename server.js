require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/ask', async (req, res) => {
  const { message } = req.body;

  const prompt = `أنت مساعد ذكي متخصص في مساعدة المستخدمين على فهم وتصفح المواقع الحكومية السعودية. أجب بشكل بسيط وواضح، واذكر الخطوات والروابط إن أمكن.\n\nسؤال المستخدم: ${message}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    res.json({ reply: response.data.choices[0].message.content });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي' });
  }
});

app.listen(3000, () => console.log('🟢 Server running at http://localhost:3000'));
