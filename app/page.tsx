import Link from "next/link";

const LOOP = ["ทำ Quiz", "วิเคราะห์ข้อผิดพลาด", "อธิบาย", "ปรับความยาก", "ฝึกซ้ำ", "วัดพัฒนาการ"];
const INNOV = [
  { tag: "นวัตกรรมหลัก", name: "AI Adaptive Quiz", desc: "ปรับระดับความยากรายคนระหว่างเล่น" },
  { tag: "นวัตกรรมหลัก", name: "AI Mistake Explainer", desc: "อธิบายว่าทำไมผิด และแนะนำการฝึกซ้ำ" },
  { tag: "นวัตกรรมหลัก", name: "Learning DNA", desc: "วิเคราะห์จุดแข็งและจุดอ่อนรายหัวข้อ" },
  { tag: "ระยะ 2", name: "Confidence-Based Quiz", desc: "แยกคนที่เข้าใจจริงกับคนที่เดาถูก" },
  { tag: "ระยะ 2", name: "Smart Revision", desc: "นัดทบทวนข้อที่ผิดตามช่วงเวลา (Spaced Repetition)" },
];

export default function Home() {
  return (
    <section className="view">
      <div className="hero">
        <div>
          <h1>QUIZVERSE</h1>
          <p className="tagline">LEARN • PLAY • CHALLENGE • GROW</p>
          <p className="lead">เรียนรู้ให้สนุก ท้าทายตัวเอง และพัฒนาความรู้ด้วย AI ที่บอกได้ว่าคุณอ่อนเรื่องไหน และควรฝึกอะไรต่อ</p>
          <div className="row">
            <Link className="btn btn-white" href="/studio">+ เริ่มสร้าง Quiz</Link>
            <Link className="btn btn-outline" href="/join">เข้าร่วมเกม</Link>
          </div>
        </div>
        <div className="hero-demo" aria-hidden="true">
          <div className="meta"><span>ห้อง 587421 · วิทยาศาสตร์</span><span>ข้อ 3/8 · ระดับปานกลาง</span></div>
          <div className="q">ข้อใดเป็นสาเหตุหลักที่ทำให้เกิดฤดูกาลบนโลก?</div>
          <div className="opts">
            <span className="ch0">A · ระยะห่างจากดวงอาทิตย์</span>
            <span className="ch1">B · แกนโลกเอียง 23.5°</span>
            <span className="ch2">C · ดวงจันทร์บังแสง</span>
            <span className="ch3">D · โลกหมุนเร็วขึ้น</span>
          </div>
          <div className="meta"><span>ความมั่นใจ: มั่นใจ</span><span>+870 คะแนน</span></div>
        </div>
      </div>

      <div className="grid feat3">
        <div className="card feat">
          <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 10h.01M15 10h.01M9 15c1.5 1 4.5 1 6 0" /></svg></div>
          <div><h3>AI สร้างคำถามจากเนื้อหา</h3><p className="muted small">วางเนื้อหาหรืออัปโหลดไฟล์ AI ร่างข้อสอบพร้อมเฉลย ครูตรวจแก้และอนุมัติก่อนเผยแพร่</p></div>
        </div>
        <div className="card feat">
          <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 20V12M12 20V7M19 20V4" /></svg></div>
          <div><h3>ปรับระดับความยาก (Adaptive Quiz)</h3><p className="muted small">ตอบถูกติดกันระบบเพิ่มความยาก ตอบผิดระบบลดระดับ ทุกคนได้โจทย์ที่พอดีกับตัวเอง</p></div>
        </div>
        <div className="card feat">
          <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3 2.8 3 6" /></svg></div>
          <div><h3>วิเคราะห์ผลการเรียนรายบุคคล</h3><p className="muted small">Learning DNA แสดงจุดแข็ง จุดที่ควรพัฒนา และสร้างแผนทบทวนอัตโนมัติ</p></div>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">วงจรการเรียนรู้ของ QUIZVERSE</p>
        <div className="loop">
          {LOOP.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              {i > 0 && <span className="arr">→</span>}
              <span className="step">{s}</span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>ฟังก์ชันเด่นที่แตกต่างจาก Kahoot</h2>
        <div className="grid innov">
          {INNOV.map((f) => (
            <div className="card" key={f.name}><span className="tag">{f.tag}</span><h4>{f.name}</h4><p className="small muted">{f.desc}</p></div>
          ))}
        </div>
      </div>

      <div className="card how">
        <p className="eyebrow">ขั้นตอนการใช้งาน</p>
        <ol>
          <li>ผู้สอนสร้างชุดคำถามเอง หรือให้ AI ช่วยร่างข้อสอบใน <Link href="/studio">สร้างแบบทดสอบ</Link></li>
          <li>ผู้สอนตรวจคำถาม อนุมัติ และเผยแพร่ ระบบสร้าง PIN 6 หลักให้</li>
          <li>ผู้เรียนกรอก PIN และชื่อเพื่อ <Link href="/join">เข้าร่วมเกม</Link> (ลองใช้ PIN ตัวอย่าง 587421)</li>
          <li>ระบบคิดคะแนนจากความถูกต้องและเวลา แล้วปรับระดับคำถามตามผลการตอบ</li>
          <li>จบเกมแล้ว ระบบแสดงอันดับ ผลสรุป และคำอธิบายข้อที่ผิด</li>
          <li>ผู้เรียนทบทวนข้อที่ผิดตามแผน และติดตามพัฒนาการใน <Link href="/dna">Learning DNA</Link></li>
        </ol>
      </div>
    </section>
  );
}
