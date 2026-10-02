طريقك — نسخة Gemini AI
=======================

هذه النسخة تستعمل Gemini بدل OpenAI للمرافق الذكي.

الملفات:
- index.html
- server.js
- package.json
- .env.example

مهم جداً:
لا تضع مفتاح Gemini داخل index.html.
ضعه فقط في متغير البيئة GEMINI_API_KEY على السيرفر.

التشغيل:
1) npm install
2) انسخ .env.example إلى .env
3) ضع مفتاح Gemini في .env
4) npm start
5) افتح http://localhost:3000

للاستضافة، ضع GEMINI_API_KEY في خانة Environment Variables/Secrets في منصة الاستضافة، ولا ترفع ملف .env إلى Git.
