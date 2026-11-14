# QUIZVERSE

**Learn • Play • Challenge • Grow** — เว็บแอปเกมตอบคำถามส่งเสริมการเรียนรู้ด้วย AI

ต่อยอดแนวคิดจาก Kahoot! แต่เน้นให้ผู้เรียนรู้ว่าตัวเองอ่อนเรื่องใด และควรฝึกอะไรต่อ ผ่านวงจร
ทำ Quiz → วิเคราะห์ข้อผิดพลาด → อธิบาย → ปรับความยาก → ฝึกซ้ำ → วัดพัฒนาการ

## หน้าจอ

| เส้นทาง | หน้าจอ |
|---|---|
| `/` | หน้าแรก |
| `/studio` | AI Quiz Studio (สร้างเอง / ให้ AI ร่าง → ครูอนุมัติ → เผยแพร่พร้อม PIN) |
| `/join` | เข้าร่วมเกมด้วย PIN 6 หลัก (ห้องตัวอย่าง PIN `587421`) |
| `/play/[pin]` | Quiz Arena (Adaptive + Confidence) ตรวจคะแนนโดยเซิร์ฟเวอร์ และผลการเล่น/อันดับ |
| `/practice` | โหมดฝึกทบทวน (Smart Revision) |
| `/login` | เข้าสู่ระบบ / สมัครสมาชิก (ครู หรือ นักเรียน) |
| `/live/host/[id]` | ห้องสด: หน้าจอครู (ขึ้นโปรเจกเตอร์) แสดง PIN รายชื่อ คำถาม จำนวนคนตอบ เฉลย และอันดับ |
| `/live/[pin]` | ห้องสด: หน้าจอนักเรียนบนมือถือ |

### ห้องสด (เล่นพร้อมกันหลายเครื่อง)

1. ครูเข้าสู่ระบบ → **เข้าร่วมเกม** → กด **เปิดห้องสด** ที่ชุดข้อสอบ → ได้ PIN ห้องสดใหม่ เปิดหน้านี้ขึ้นจอ
2. นักเรียนเปิด `/join` กรอก PIN ระบบรู้เองว่าเป็นห้องสด
3. ครูกด **เริ่มเกม** → ทุกคนเห็นข้อเดียวกัน → ระบบเฉลยเองเมื่อหมดเวลาหรือทุกคนตอบครบ → **ข้อต่อไป** → จบเกม

ตรวจคะแนนและจับเวลาบนเซิร์ฟเวอร์ ฐานข้อมูลบังคับให้ตอบได้ข้อละครั้ง Supabase Realtime ส่งแค่สัญญาณให้ทุกเครื่องดึงสถานะใหม่จากเซิร์ฟเวอร์ (และดึงซ้ำทุก 2-3 วินาทีเผื่อสัญญาณหาย) นักเรียนจึงปลอมข้อความเพื่อโกงไม่ได้ จบเกมแล้วผลเข้า Learning DNA อัตโนมัติ
| `/dna` | Learning DNA: จุดแข็ง จุดอ่อน แผนทบทวน รางวัลจากพัฒนาการ |

## โครงสร้างโค้ด

```
app/          หน้าจอ (Next.js App Router)
components/   Topbar, Toast, RadarChart
lib/
  grading.ts    คิดคะแนน (ระยะ 3 ย้ายไปฝั่งเซิร์ฟเวอร์)
  adaptive.ts   ปรับระดับความยาก + เลือกข้อถัดไป
  profile.ts    Learning DNA + Smart Revision
  storage.ts    ที่เก็บข้อมูล (ตอนนี้ localStorage → ระยะ 3 เปลี่ยนเป็น Supabase)
  ai.ts         ทุกฟีเจอร์ AI ฝั่งเบราว์เซอร์ผ่านไฟล์นี้ (เรียก /api/ai/*)
  server/       โค้ดฝั่งเซิร์ฟเวอร์เท่านั้น: gemini.ts, extract.ts (อ่าน PDF/DOCX), rateLimit.ts
app/api/ai/     API Route ที่เรียก Gemini
```

## รันบนเครื่อง

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:3000

### เชื่อมฐานข้อมูล (Supabase)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (Region: Southeast Asia (Singapore))
2. **SQL Editor → New query** วางไฟล์แล้วกด **Run** ตามลำดับ: [`supabase/schema.sql`](supabase/schema.sql) → [`supabase/seed.sql`](supabase/seed.sql) (ห้องตัวอย่าง PIN 587421) → [`supabase/live.sql`](supabase/live.sql) (ห้องสดหลายเครื่อง)
3. **Project Settings → API Keys** คัดลอกค่าไปใส่ใน `.env.local` (ดู `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
4. **Authentication → URL Configuration** ตั้ง Site URL เป็นลิงก์ Vercel และเพิ่ม `http://localhost:3000/**` กับ `https://<ลิงก์ vercel>/**` ใน Redirect URLs
5. (ทางเลือก สำหรับโครงงาน) **Authentication → Sign In / Providers → Email** ปิด *Confirm email* เพื่อสมัครแล้วใช้ได้ทันที

| ตาราง | เก็บอะไร | ใครเข้าถึงได้ (Row Level Security) |
|---|---|---|
| `profiles` | ชื่อ บทบาท ครู/นักเรียน, Learning DNA (`learning` jsonb) | เจ้าของอ่าน/แก้ของตัวเอง เปลี่ยนบทบาทตัวเองไม่ได้ |
| `quizzes` | ห้องเกม PIN ชื่อชุด เจ้าของ | ทุกคนเห็นห้องตัวอย่าง ครูเห็นและจัดการห้องของตัวเอง |
| `questions` | คำถาม ตัวเลือก **เฉลย** คำอธิบาย | เฉพาะครูเจ้าของห้อง นักเรียนรับคำถามผ่าน API ที่ซ่อนเฉลย |
| `game_sessions`, `answers` | ทุกเกมและทุกคำตอบ (ไว้ทำรายงานครูในระยะ 5) | เซิร์ฟเวอร์เท่านั้น |

**การตรวจคะแนนฝั่งเซิร์ฟเวอร์:** `/api/game/start` → `/api/game/answer` → `/api/game/next` เบราว์เซอร์ได้คำถามโดยไม่มีเฉลย เซิร์ฟเวอร์จับเวลาเอง และนับเฉพาะคำตอบแรกของแต่ละข้อ

### เปิดใช้ AI (Gemini)

1. สร้าง API key ที่ [Google AI Studio](https://aistudio.google.com) → **Get API key**
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ key: `GEMINI_API_KEY=...`
3. หยุดแล้วรัน `npm run dev` ใหม่ ปุ่ม AI จะเปิดใช้งาน

AI ทำงานผ่าน API ของเว็บเราเอง (`app/api/ai/*`) key จึงอยู่บนเซิร์ฟเวอร์เท่านั้น ไม่หลุดไปถึงเบราว์เซอร์

| API | ใช้ทำอะไร | โมเดล (เปลี่ยนได้ใน env) |
|---|---|---|
| `POST /api/ai/generate` | สร้างข้อสอบจากหัวข้อ ข้อความ หรือไฟล์ PDF/DOCX/TXT | `GEMINI_MODEL` (ค่าเริ่มต้น `gemini-3.5-flash-lite` ถ้าโมเดลที่ตั้งไว้ช้าเกิน 25 วินาทีจะสลับไปโมเดลเร็วอัตโนมัติ) |
| `POST /api/ai/explain` | อธิบายข้อผิด + สร้างโจทย์ฝึกแก้จุดอ่อน 1 ข้อ | `GEMINI_MODEL_FAST` (ค่าเริ่มต้น `gemini-3.5-flash-lite`) |
| `POST /api/ai/coach` | แผนการเรียน 7 วัน (ส่งเฉพาะคะแนน ไม่ส่งชื่อนักเรียน) | `GEMINI_MODEL_FAST` |
| `GET /api/ai/status` | บอกหน้าเว็บว่าตั้ง key แล้วหรือยัง | – |

ข้อสอบที่ AI สร้างเป็นเพียงร่าง ครูต้องตรวจและอนุมัติทุกข้อก่อนเผยแพร่ แต่ละเครื่องเรียก AI ได้ไม่เกิน 30 ครั้งต่อ 10 นาที เพื่อกันโควตาหมด

## ขึ้นออนไลน์ (GitHub → Vercel)

1. สร้าง repository ใหม่บน GitHub (ไม่ต้องติ๊กสร้าง README) แล้ว push:
   ```bash
   git remote add origin https://github.com/<ชื่อบัญชี>/quizverse.git
   git push -u origin main
   ```
2. เข้า [vercel.com](https://vercel.com) → ล็อกอินด้วย GitHub → **Add New → Project** → เลือก `quizverse`
   → เปิด **Environment Variables** ใส่ทุกตัวใน `.env.example` (Gemini + Supabase 3 ตัว) → **Deploy**
   (ถ้า deploy ไปแล้ว: Settings → Environment Variables → เพิ่ม key → Deployments → **Redeploy**)
3. ทุกครั้งที่ push เข้า `main` เว็บจะอัปเดตเอง ส่วน Pull Request จะได้ลิงก์ Preview แยก

ห้าม commit ไฟล์ `.env*` หรือ API key (ถูกกันไว้ใน `.gitignore` แล้ว) ให้ใส่ key ใน Vercel → Settings → Environment Variables

## แผนพัฒนา

- [x] **ระยะ 1** Next.js + Vercel (ข้อมูลเก็บในเบราว์เซอร์, เพื่อนร่วมห้องเป็นผู้เล่นจำลอง)
- [x] **ระยะ 2** AI ผ่าน Gemini API (`GEMINI_API_KEY`), อ่านไฟล์ PDF/DOCX, Mistake Explainer สร้างโจทย์ฝึก
- [x] **ระยะ 3** Supabase: ล็อกอินครู/นักเรียน, ฐานข้อมูล, ตรวจคะแนนฝั่งเซิร์ฟเวอร์
- [x] **ระยะ 4** Live Quiz หลายเครื่องพร้อมกัน (Supabase Realtime)
- [ ] **ระยะ 5** เครื่องมือครู: คลังข้อสอบ, รายงานผล, Teacher Early Alert, รูปประกอบคำถาม
