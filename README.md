# 55 — Hip Hop Battle

MVP احترافي قابل للتطوير للعبة 55.

## التشغيل
1. ثبّت Node.js 20+
2. داخل المجلد:
   npm install
   npm run dev
3. افتح: http://localhost:3000

## ما هو موجود
- Lobby بدون حسابات
- ID مؤقت لكل Session
- مجموعتان حتى 6 ضد 6
- Group Admin تلقائي لأول عضو
- تعيين Answer Captain
- مباراة تلقائية عند 6/6
- 30 ثانية للسؤال
- +3 صحيح / -2 غلط / -1 بدون جواب
- الفوز عند 55
- Queue حسب ترتيب الانضمام
- Spectator mode
- تعليقات مرتبطة بالفريق
- أساس Socket.IO للحالة اللحظية

## المرحلة التالية للإنتاج
- WebRTC voice rooms مع صلاحيات الاستماع حسب الفريق
- Redis/PostgreSQL
- rate limiting وanti-abuse
- reconnect/session recovery
- لوحة إدارة الأسئلة والتحقق منها
- matchmaking/challenge بين مجموعات أقل من 6
- إشعارات وعدادات المشاهدين
- HTTPS وTURN server للصوت
