import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ضع GEMINI_API_KEY داخل ملف .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const SYSTEM_PROMPT = `
أنت "المرافق" داخل منصة جزائرية اسمها "طريقك".

أنت مدرب شخصي للمستخدم، وليس روبوت ردود جاهزة.

هدفك أن تساعد المستخدم يفهم وضعه، يتعلم مهارة، يطبق، يرسل لك النتيجة، ثم تراجعه وتعدل له الخطة.

القواعد:
- تكلم بدارجة جزائرية طبيعية عندما يكون أسلوب المستخدم جزائرياً.
- لا تكرر نفس الإجابات أو نفس المقدمة في كل رسالة.
- استعمل معلومات المستخدم ومساره ومستواه وتقدمه والمهمة الحالية.
- ركز على الخطوة التالية، ولا تغرق المستخدم في خطوات كثيرة بدون حاجة.
- إذا كانت المعلومات ناقصة، اسأل سؤالاً أو سؤالين محددين.
- إذا فشل المستخدم، شخّص السبب وساعده يعدل المحاولة.
- إذا أرسل نتيجة عمل، راجعها: ما هو جيد، ما يحتاج تحسين، وما الذي يفعله بعد ذلك.
- لا تعد المستخدم بربح أو وظيفة مضمونة.
- لا تقل له إنك تستطيع تنفيذ العمل بدلاً منه؛ أنت تعلمه وتوجهه.
- لا تبدأ كل إجابة بـ "فهمتك" ولا تكرر التشجيع بشكل آلي.
- لا تقل "أنا مجرد ذكاء اصطناعي" إلا إذا كان السؤال متعلقاً بهويتك.
- لا تفترض أن المستخدم عنده PC أو رأس مال إذا كانت بياناته تقول غير ذلك.
- إذا كان لديه هاتف فقط، اقترح ما يمكن فعله بالهاتف.
- عندما تكون المهمة مناسبة لمساره الحالي، اربط الإجابة بها.
- إذا سأل "وش ندير اليوم؟" أعطه مهمة واحدة واضحة مرتبطة بمستواه.
- المستخدم جزائري والسياق المالي بالدينار الجزائري.
- لا تخترع معلومات غير موجودة في بيانات المستخدم.
`;

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(x =>
      x &&
      (x.role === "user" || x.role === "bot" || x.role === "assistant") &&
      typeof x.text === "string"
    )
    .slice(-16)
    .map(x => ({
      role: x.role === "user" ? "user" : "model",
      text: x.text.slice(0, 5000)
    }));
}

function makeContext(context = {}) {
  return `
بيانات المستخدم الحالية:

الاسم: ${context.name || "غير محدد"}
العمر: ${context.age || "غير محدد"}
الولاية: ${context.wilaya || "غير محددة"}
المستوى الدراسي: ${context.study || "غير محدد"}
الحالة: ${context.work || "غير محددة"}
الوقت المتاح يومياً: ${context.hours || "غير محدد"}
الجهاز: ${context.device || "غير محدد"}
الإنترنت: ${context.internet || "غير محدد"}
رأس المال: ${context.money || "غير محدد"}
إمكانية الخروج للعمل: ${context.mobility || "غير محددة"}
الاهتمامات: ${Array.isArray(context.interests) ? context.interests.join("، ") : "غير محددة"}
يفضل العمل: ${context.people || "غير محدد"}
مكان العمل: ${context.place || "غير محدد"}
نوع العمل: ${context.type || "غير محدد"}
الالتزام: ${context.commit || "غير محدد"}
الهدف: ${context.goal || "غير محدد"}

المسار الحالي: ${context.trackName || "لا يوجد"}
وصف المسار: ${context.trackDescription || "لا يوجد"}
الأدوات: ${context.trackTools || "لا يوجد"}
نسبة التقدم: ${context.progress ?? 0}%
المستوى: ${context.level ?? 0}/5
المهام المكتملة: ${Array.isArray(context.completedTasks) ? context.completedTasks.join(", ") || "لا توجد" : "لا توجد"}

المهمة الحالية:
${context.currentTask ? JSON.stringify(context.currentTask, null, 2) : "لا توجد"}

أسلوب التواصل المطلوب: ${context.mentorStyle || "dz"}
`;
}

function buildPrompt(message, history, context) {
  const previous = cleanHistory(history)
    .map(x => `${x.role === "user" ? "المستخدم" : "المرافق"}: ${x.text}`)
    .join("\n\n");

  return `
${makeContext(context)}

سجل المحادثة الأخيرة:
${previous || "لا توجد محادثة سابقة."}

رسالة المستخدم الجديدة:
${message}

جاوب الآن مباشرة كـ "المرافق".
`;
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "طريقك Gemini Backend يعمل بنجاح",
    model: MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, context } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "الرسالة فارغة."
      });
    }

    const prompt = buildPrompt(message.trim().slice(0, 5000), history, context);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 900,
        temperature: 0.8
      }
    });

    const answer = response.text?.trim();

    if (!answer) {
      throw new Error("Gemini returned an empty response");
    }

    res.json({
      success: true,
      answer
    });

  } catch (error) {
    console.error("Gemini error:", error);

    res.status(500).json({
      success: false,
      error: "حدث خطأ في الاتصال بالمرافق الذكي. تأكد من مفتاح Gemini وحاول مرة أخرى."
    });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log("");
  console.log("================================");
  console.log("🚀 طريقك — Gemini AI Backend");
  console.log("================================");
  console.log(`http://localhost:${PORT}`);
  console.log(`🤖 Gemini model: ${MODEL}`);
  console.log("================================");
});
