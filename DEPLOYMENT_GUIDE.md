# دليل النشر والاختبار — AbayaRidaa ERP

> **آخر تحديث**: 2026-08-15  
> **الهدف**: إرشاد المشرف لنشر التحديثات الأمنية الجديدة واختبارها فعلياً.

---

## 🚨 المتطلبات الأساسية قبل النشر

هذا الدليل يفترض أن لديك:
- [ ] Supabase CLI مثبت (`brew install supabase/tap/supabase` أو من [الموقع الرسمي](https://supabase.com/docs/guides/cli))
- [ ] بيئة تشغيل تدعم Node.js 18+ و npm 9+
- [ ] بريد Gmail/Zoho/Outlook مع **App Password** (ليس كلمة المرور العادية)
- [ ] وصول للمشروع على Supabase Dashboard: `wtvbkjnyluwvsbagwtvb`

---

## 📦 الخطوة 1: نشر Edge Functions

الإصلاحات الأمنية التالية موجودة في الكود لكنها **لن تُفعّل** حتى تنشر Edge Functions:

| الوظيفة | الإصلاح المطلوب النشر |
|--------|------------------------|
| `invite-user` | ✅ فحص صلاحية admin server-side |
| `invite-user` | ✅ إزالة كلمات المرور من notifications |
| `invite-user` | ✅ تصحيح `user_metadata` (منع خطأ ipNotInner) |
| `invite-user` | ✅ إصلاح TLS handshake على المنفذ 587 |
| `send-email` | ✅ فحص صلاحية admin server-side |
| `send-email` | ✅ منع smtpConfig القادم من المتصفح واستخدام SMTP_PASSWORD الخادمي |
| `send-email` | ✅ إصلاح TLS handshake على المنفذ 587 |
| `audit-event` | ✅ تسجيل Append-Only مع HMAC من الخادم |
| `notify-admin` | ✅ منع unauthenticated invocations |

### الأمر:
```bash
cd /path/to/AbayaRidaa
supabase link --project-ref wtvbkjnyluwvsbagwtvb
supabase functions deploy invite-user
supabase functions deploy send-email
supabase functions deploy notify-admin
supabase functions deploy audit-event
```

### التحقق من النشر:
```bash
supabase functions list
```
يجب أن تظهر الوظائف الثلاث مع `Updated at` قريب من الآن.

---

## 📧 الخطوة 2: اختبار SMTP مع Gmail

### تجهيز App Password (مطلوب لـ Gmail):
1. افتح: https://myaccount.google.com/security
2. فعّل **2-Step Verification** (إذا لم يكن مفعّلاً)
3. افتح: https://myaccount.google.com/apppasswords
4. اختر **Mail** ثم **Other** واسم الجهاز "AbayaRidaa"
5. انسخ الـ 16 حرف الظاهرة (بدون مسافات)

### الاختبار داخل النظام:
1. سجّل دخول بحساب المشرف
2. اذهب لـ `/settings` → قسم **SMTP**
3. أدخل:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Use TLS**: ✅ (أو اتركه — النظام يتجاهله الآن ويقرر تلقائياً)
   - **Username**: بريد Gmail الكامل
   - **Password**: لا تُدخلها هنا؛ ضع App Password في Secret باسم `SMTP_PASSWORD` داخل Supabase
   - **From Email**: نفس بريد Gmail
   - **From Name**: `رداء`
4. ضع `SMTP_PASSWORD` في Supabase Edge Function Secrets ثم اضغط **حفظ** لإعدادات البريد غير الحساسة
5. اضغط **اختبار SMTP** وأدخل بريد الاختبار
6. ✅ **متوقع**: رسالة "تم تسليم الرسالة إلى خادم SMTP بنجاح"
7. تحقق من صندوق الوارد وSpam خلال 30 ثانية؛ لا تُرسل كلمات مرور الأعضاء أو رموز التحقق بالبريد

### إذا فشل:
| رسالة الخطأ | السبب | الحل |
|-------------|-------|------|
| `535 Authentication failed` | كلمة مرور خاطئة | استخدم App Password (ليس كلمة المرور العادية) |
| `Connection timeout` | Firewall يحجب المنفذ | جرّب Port 465 مع TLS |
| `InvalidContentType` | الإصلاح لم يُنشر بعد | نفّذ `supabase functions deploy send-email` |
| `Relay access denied` | البريد لا يتطابق مع الحساب | تأكد أن From Email = Username |

---

## 🛡️ الخطوة 3: التحقق من تصعيد RLS

### السيناريو: مستخدم عادي يحاول رفع نفسه لـ super_admin

1. سجّل دخول **بحساب accountant** (أو أي دور غير admin) في متصفح منفصل
2. افتح DevTools → Console
3. نفّذ:
   ```javascript
   const { data, error } = await window.supabase
     .from('user_roles')
     .insert({
       user_id: (await window.supabase.auth.getUser()).data.user.id,
       assigned_user_email: 'me@example.com',
       role: 'super_admin',
       permissions: '[]',
       is_active: true
     });
   console.log('Result:', error || data);
   ```
4. ✅ **متوقع**: خطأ مثل:
   ```
   {
     code: '42501',
     message: 'new row violates row-level security policy for table "user_roles"'
   }
   ```
5. ❌ **إذا نجح الـ insert**: السياسات لم تُطبَّق — راجع Supabase Dashboard → Authentication → Policies

### اختبارات إضافية:
- كرر نفس الاختبار على `partners_config`, `sales_reps`, `rep_pricing`
- كل واحد يجب أن يرفض insert من غير المشرف

---

## 👥 الخطوة 4: اختبار تدفق الدعوة الكامل

### كمشرف عام (admin):
1. سجّل دخول
2. اذهب لـ `/roles`
3. اضغط **إنشاء مستخدم جديد**
4. أدخل:
   - **البريد**: `test-accountant@example.com` (بريد حقيقي يمكنك الوصول إليه)
   - **الدور**: `محاسب`
   - **كلمة المرور المؤقتة**: `Temp1234!` (8 أحرف على الأقل)
   - **الاسم**: `محاسب تجريبي`
5. اضغط **إنشاء**
6. ✅ **متوقع**:
   - رسالة نجاح بدون تحذيرات
   - لا يتم إرسال كلمة المرور أو أي رمز تحقق إلى المستخدم
   - لا يظهر السر في `/notifications` أو سجلات الوظائف

### كمستخدم جديد (accountant):
1. افتح متصفح **خاص/incognito**
2. اذهب لـ `/login`
3. سجّل دخول بـ `test-accountant@example.com` + `Temp1234!`
4. ✅ **متوقع**: توجيه تلقائي لـ `/change-password`
5. حاول فتح `/dashboard` مباشرة عبر URL
6. ✅ **متوقع**: يعيدك لـ `/change-password` (Guard يعمل)
7. غيّر كلمة المرور لكلمة قوية جديدة (مثل `NewStrong@2026`)
8. ✅ **متوقع**: توجيه لـ `/login` تلقائياً بعد الحفظ
9. سجّل دخول بكلمة المرور الجديدة
10. ✅ **متوقع**: تدخل `/dashboard` بشكل طبيعي (بدون إعادة توجيه)

### اختبار الصلاحيات:
- accountant يجب أن يرى: dashboard, debts, expenses, receipts, reports, export, suppliers, partners
- accountant **يجب ألا** يرى: roles, settings, audit
- حاول فتح `/roles` مباشرة → يجب أن يعيدك لصفحة رئيسية أو 403

### اختبار إعادة الدعوة:
1. من `/roles`، اضغط **إنشاء** بنفس البريد `test-accountant@example.com` مرة أخرى
2. ✅ **متوقع**: رسالة "تم تحديث الحساب" (وليس "تم إنشاء") — كلمة المرور تُحدَّث دون إنشاء duplicate

---

## 🔨 الخطوة 5: إصلاح خطأ esbuild permission denied

### الحل السريع:
```bash
bash scripts/fix-build.sh
```

### الحل الشامل (إذا فشل الحل السريع):
```bash
bash scripts/fix-build.sh --clean
```

### الحل اليدوي:
```bash
chmod +x node_modules/.bin/*
chmod +x node_modules/@esbuild/*/bin/*
npm run build
```

### إذا كنت على CI/CD (GitHub Actions مثلاً):
```yaml
- name: Install dependencies
  run: npm ci  # يحفظ الصلاحيات بشكل صحيح
- name: Build
  run: npm run build
```

---

## ✅ قائمة التحقق النهائية بعد النشر

| # | التحقق | الطريقة | ملاحظات |
|---|--------|---------|---------|
| 1 | Edge Functions محدَّثة | `supabase functions list` | Updated at حديث |
| 2 | SMTP يرسل فعلياً | Test Email من Settings بعد ضبط `SMTP_PASSWORD` | السر موجود في Supabase Secrets فقط |
| 3 | RLS لا يسمح للـ accountant بترقية نفسه | DevTools Console | يجب أن يفشل بخطأ 42501 |
| 4 | إنشاء مستخدم accountant ينجح | من `/roles` | Success بدون warnings |
| 5 | Password Change Guard يعمل | كـ user جديد | يعيد التوجيه لـ `/change-password` |
| 6 | Guard لا يمكن تجاوزه | زيارة `/dashboard` مباشرة | يعيد التوجيه أيضاً |
| 7 | تغيير كلمة المرور يزيل الـ flag | Login بعد التغيير | يدخل dashboard بدون توجيه |
| 8 | esbuild يعمل | `npm run build` | ينتهي بدون خطأ |
| 9 | لا كلمات مرور في notifications | `SELECT ... WHERE message LIKE '%كلمة المرور%'` | يجب أن يعيد 0 |
| 10 | جميع المستخدمين لديهم user_profiles | استعلام JOIN | لا orphans |

---

## 🆘 استكشاف الأخطاء الشائعة

### "Edge Function returned a non-2xx status code"
هذه رسالة عامة من supabase-js. للحصول على السبب الحقيقي:
```typescript
if (error instanceof FunctionsHttpError) {
  const text = await error.context.text();
  console.log('Real error:', text);
}
```
أو افتح Supabase Dashboard → Functions → Logs.

### "Signups not allowed for this instance"
هذا **صحيح ومقصود** — إعدادات Auth تمنع التسجيل الذاتي.
الحسابات تُنشأ فقط من `/roles` بواسطة المشرف.

### "must_change_password" لا يتفعّل
تحقق من أن الـ trigger `sync_user_metadata` يعمل:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated');
```

---

## 📞 الدعم

للمشاكل التقنية غير المذكورة أعلاه: contact@onspace.ai


---

## تحديثات الأداء وإصلاح إنشاء الحساب — 2026-08-16

تم تحديث الواجهة لتستخدم `React.lazy` و`Suspense` للمسارات، وتم تحويل الشعار والخلفية وصورة المشاركة إلى WebP مضغوط. كما أصبح تحميل `xlsx` ديناميكيًا عند إنشاء التقرير فقط، وأصبح طلب إعدادات العلامة التجارية في صفحة الدخول مؤجلًا مع cache جلسة محلية.

تم تحديث `supabase/functions/invite-user` ليُنشئ المستخدم بالحقول الأساسية أولًا، ثم يحاول حفظ `user_metadata` في عملية منفصلة غير مانعة. هذا يعالج خطأ `ipNotInner` الذي كان يظهر أثناء `createUser` عندما تتعارض metadata مع trigger أو إعداد Auth قديم.

بعد رفع الكود، يجب نشر الوظيفة فعليًا إلى Supabase، لأن رفع ملفات المستودع وحده لا يحدّث Edge Function المنشورة:

```bash
npx supabase login
npx supabase functions deploy invite-user --project-ref wtvbkjnyluwvsbagwtvb
```

بعد النشر، اختبر إنشاء حساب جديد من `/roles` بحساب مشرف، وتحقق من أن الحساب يظهر في `user_roles` وأن تسجيل الدخول بالحساب الجديد يعمل. إذا استمر ظهور `ipNotInner` بعد النشر، راجع Logs الخاصة بالـ Edge Function وtriggers الخاصة بـ `auth.users`، لأن السبب عندها سيكون في إعداد قاعدة البيانات وليس في حزمة الواجهة.

## تحديثات 2026-08-21: الإنتاج والموافقات والتدقيق الآمن

أضيف إلى المستودع الترحيل `supabase/migrations/202608210001_security_production_workflows.sql`. يضيف الترحيل جداول الإنتاج اليومي والتكاليف، طلبات موافقات مرتجعات العملاء والموردين، أحداث الموافقة، توقيعات تقارير الشريك، وسجل `audit_events` Append-Only مع أرشيف وقواعد RLS.

طبّق الترحيل أولاً على مشروع Supabase تجريبي، ثم نفذه على المشروع الحقيقي بعد أخذ نسخة احتياطية واختبار الاستعادة. بعد ذلك انشر الوظائف الجديدة والمعدلة:

```bash
supabase functions deploy audit-event
supabase functions deploy send-email
```

اضبط Secrets الخاصة بوظيفة `audit-event` دون وضعها في `.env` أو الواجهة:

```bash
supabase secrets set AUDIT_HMAC_KEY_B64="<base64-random-key>" AUDIT_HMAC_KEY_ID="v1"
```

اضبط Secret `SMTP_PASSWORD` لوظيفة `send-email`. لا ترسل `smtpConfig` من المتصفح؛ الوظيفة ترفضه الآن وتقرأ كلمة المرور من Secret خادمي. يمكن حفظ Host وPort وUsername وبيانات المرسل غير الحساسة في إعدادات النظام، لكن لا تحفظ كلمة المرور في حالة React أو في مستودع Git.

لتشغيل أرشفة سجل المراجعة دورياً، استخدم Scheduled Edge Function أو وظيفة خارجية بصلاحية `service_role` لاستدعاء:

```sql
select public.archive_old_audit_events(now() - interval '180 days', 5000);
```

لا تستدعِ دالة الأرشفة من المتصفح. احتفظ بنسخة الأرشيف في تخزين مركزي غير قابل للتعديل إذا كانت متطلبات التدقيق أو القانون تتطلب ذلك.

### تحقق قبول سريع

بعد النشر، سجّل دفعة إنتاج بحساب موظف عمليات وتأكد من ظهورها بحالة `SUBMITTED`. سجّل دخول المدير العام واعتمد طلب مرتجع، ثم تحقق من ظهور قرار الاعتماد في `return_approval_events`. افتح `/audit` بحساب المدير العام وتأكد من ظهور `entry_hash` وحالة `متحقق`. افتح `/partner-dashboard` بحساب الشريك وتأكد من أن الصفحة قراءة فقط، وأن التوقيع يحفظ `content_hash` ولا يمكن تحديثه أو حذفه مباشرة.

إذا فشل البريد، لا تعِد إرسال العملية المالية تلقائياً. افحص سجل الوظيفة و`request_id`، ثم أصلح Secret أو إعداد SMTP وأعد اختبار البريد التشغيلي فقط.
