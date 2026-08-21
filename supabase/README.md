# تشغيل Supabase الآمن في AbayaRidaa

هذا الدليل يخص مشروع AbayaRidaa ويشرح ما يجب وضعه في **Supabase Secrets** وما يجب أن يبقى خارج الواجهة وGitHub. لا تضع أي قيمة سرية داخل `.env` المرفوع أو داخل ملفات React.

## 1. الأسرار المطلوبة

| الاسم | الاستخدام | مكان الضبط | هل يظهر في المتصفح؟ |
|---|---|---|---|
| `AUDIT_HMAC_KEY_B64` | توقيع سلسلة سجل المراجعة في وظيفة `audit-event` | Supabase Edge Function Secret | لا |
| `AUDIT_HMAC_KEY_ID` | رقم إصدار مفتاح HMAC، مثل `v1` | Supabase Edge Function Secret | لا |
| `SMTP_PASSWORD` | App Password أو API Key لخدمة البريد | Supabase Edge Function Secret | لا |

مفتاح HMAC يجب أن يكون عشوائياً بطول قوي، ويُحفظ خارج قاعدة البيانات. لا ترسل المفتاح إلى المستخدم ولا تسجله في Audit Log. عند تدويره، أنشئ مفتاحاً جديداً بمعرّف جديد مثل `v2`، واحتفظ بالمفتاح القديم في نظام تحقق داخلي إلى أن تنتهي فترة الاحتفاظ اللازمة للسجلات القديمة.

## 2. الضبط من لوحة Supabase

افتح مشروع Supabase الصحيح، ثم اذهب إلى **Project Settings → Edge Functions → Secrets**. أضف الأسماء الثلاثة السابقة والقيم الخاصة بها. لا تضع `SUPABASE_URL` أو `SUPABASE_ANON_KEY` يدوياً إذا كان Supabase يوفرهما تلقائياً للوظائف. لا تنسخ `SUPABASE_SERVICE_ROLE_KEY` إلى الواجهة أو إلى ملفات المشروع.

بعد ضبط Secrets، انشر وظائف `audit-event` و`send-email`. إعادة نشر الوظيفة ضرورية حتى تبدأ نسخة الوظيفة المنشورة باستخدام القيم الجديدة.

## 3. الضبط باستخدام CLI

نفّذ الأوامر من جهاز موثوق بعد تسجيل الدخول إلى Supabase وربط المشروع الصحيح. استبدل القيمة الوهمية بمفتاح حقيقي؛ لا تضعها في سجل المحادثة أو في Issue عام.

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set \
  AUDIT_HMAC_KEY_B64="<BASE64_RANDOM_KEY>" \
  AUDIT_HMAC_KEY_ID="v1" \
  SMTP_PASSWORD="<SMTP_APP_PASSWORD>"

supabase functions deploy audit-event
supabase functions deploy send-email
supabase functions deploy notify-admin
supabase functions deploy invite-user
```

لتوليد مفتاح HMAC بصيغة Base64 على جهاز محلي موثوق:

```bash
openssl rand -base64 32
```

لا تستخدم كلمة مرور Gmail العادية. استخدم App Password مخصصاً للبريد، أو API Key من مزود SMTP. كلمة المرور لا تُحفظ في صفحة الإعدادات ولا تُرسل مع طلب اختبار البريد.

## 4. تطبيق الترحيل

طبّق `migrations/202608210001_security_production_workflows.sql` أولاً على مشروع تجريبي. خذ نسخة احتياطية قبل التطبيق على الإنتاج. الترحيل يضيف الإنتاج والتكاليف وطلبات المرتجعات والتوقيعات وسجل المراجعة والأرشيف وسياسات RLS.

إذا كان Supabase CLI مربوطاً بالمشروع:

```bash
supabase db push
```

إذا كان المشروع يستخدم طريقة ترحيل مختلفة، نفّذ الملف من SQL Editor بعد مراجعته، ولا تنفذه مرتين في وقت واحد.

## 5. اختبار سجل المراجعة

بعد نشر وظيفة `audit-event`، سجّل عملية غير حساسة من الواجهة. يجب أن يظهر صف في `public.audit_events` يحتوي على `previous_hash` و`entry_hash` و`key_id`. يجب أن يفشل مستخدم عادي عند محاولة `UPDATE` أو `DELETE` على السجل. القراءة الكاملة للسجل محصورة بالمدير العام وفق سياسة RLS الحالية.

يُحظر استدعاء `append_audit_event` من `anon` و`authenticated` مباشرة؛ الوظيفة الخادمية هي التي تتحقق من هوية المستخدم وتخفي الحقول الحساسة ثم تستدعي الدالة بصلاحية `service_role`.

## 6. اختبار بوابة الشريك

سجّل الدخول بحساب شريك حقيقي في بيئة الاختبار. تحقق من أن الشريك يستطيع رؤية التقرير المالي المخصص له فقط، ولا يستطيع فتح `/roles` أو `/settings` أو `/audit` أو تعديل الطلبات والمصروفات. عند توقيع التقرير، يجب حفظ `content_hash` ووقت التوقيع والاسم القانوني ونص الموافقة. لا تمنح التوقيع صلاحية تعديل التقرير.

يجب اختبار RLS بحساب شريك ثانٍ؛ يجب ألا يستطيع قراءة توقيع الشريك الأول أو بياناته. إذا ظهرت بيانات غير مخصصة، أوقف الاستخدام المالي فوراً وراجع سياسات RLS ومصدر التقرير قبل النشر.

## 7. أرشفة سجل المراجعة

لا تستدعِ الأرشفة من المتصفح. شغّل `archive_old_audit_events` بواسطة Scheduled Edge Function أو خدمة موثوقة بصلاحية `service_role` وفق سياسة الاحتفاظ المعتمدة:

```sql
select public.archive_old_audit_events(now() - interval '180 days', 5000);
```

الأرشيف لا يسمح للمستخدمين العاديين بتعديله أو حذفه. بالنسبة لمتطلبات التدقيق الأقوى، صدّر نسخة دورية إلى تخزين مركزي غير قابل للتعديل مع الاحتفاظ بالبصمة وسجل عملية التصدير.

## 8. ما الذي لا يجب فعله

لا تضع `AUDIT_HMAC_KEY_B64` أو `SMTP_PASSWORD` في `VITE_*`، ولا تضفها إلى GitHub Actions logs، ولا ترسلها في البريد أو WhatsApp، ولا تعرضها في صفحة الإعدادات. لا تستخدم مفتاح `service_role` في React. ولا تعتبر نجاح بناء الواجهة دليلاً على تطبيق الترحيل أو نشر الوظائف؛ يجب التحقق من ذلك داخل Supabase Dashboard وLogs.

## 9. تشغيل محلي قبل النشر

تحتاج المحاكاة المحلية إلى Docker يعمل وSupabase CLI. من جذر المشروع شغّل:

```bash
supabase start
supabase db reset
supabase functions serve audit-event --env-file supabase/.env.local
```

أنشئ `supabase/.env.local` محلياً فقط ولا ترفعه إلى GitHub:

```dotenv
AUDIT_HMAC_KEY_B64=<local-only-base64-key>
AUDIT_HMAC_KEY_ID=local-v1
SMTP_PASSWORD=<local-test-password>
```

اختبر الوظيفة من جلسة مستخدم محلية حقيقية أو بطلب يحمل JWT محلياً. يجب أن ترفض الوظيفة طلباً بلا Authorization، وأن ترفض أي body يحتوي على `smtpConfig`، وأن تسجل الحدث عبر `append_audit_event` فقط. لا تستخدم `SUPABASE_SERVICE_ROLE_KEY` داخل JavaScript في المتصفح.

نفّذ فحوص المشروع بعد تشغيل الواجهة:

```bash
npm run verify
python3 -m py_compile scripts/verify_audit_chain.py
bash -n scripts/configure-supabase-secure.sh
```

لا تشغّل `configure-supabase-secure.sh` على مشروع الإنتاج أثناء الاختبار المحلي؛ السكربت مخصص للربط والنشر الفعلي. استخدم مشروع Supabase المحلي أو مشروعاً تجريبياً منفصلاً.

## 10. التحقق من HMAC بعد النشر

بعد تنفيذ حدث اختباري غير حساس، استخرج السجلات بصلاحية قراءة إدارية من SQL Editor دون عرض المفتاح أو البيانات الحساسة:

```sql
select sequence, tenant_key, action, entity_type, result,
       key_id, previous_hash, entry_hash, occurred_at
from public.audit_events
where tenant_key = 'default'
order by sequence desc
limit 20;
```

يجب أن يكون `previous_hash` لأول سجل هو `GENESIS`، وأن يساوي `previous_hash` لكل سجل لاحق قيمة `entry_hash` للسجل السابق عند ترتيب `sequence` تصاعدياً. وجود `key_id` يوضح إصدار المفتاح المستخدم دون كشف المفتاح نفسه.

لإعادة حساب السلسلة آلياً من جهاز إداري موثوق، لا تضع القيم في GitHub أو سجل CI:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<ضعها في جلسة محلية فقط>"
export AUDIT_HMAC_KEY_B64="<نفس مفتاح الإصدار الحالي>"
export AUDIT_TENANT_KEY="default"
python3 scripts/verify_audit_chain.py
unset SUPABASE_SERVICE_ROLE_KEY AUDIT_HMAC_KEY_B64
```

النتيجة الناجحة تكون بصيغة `OK: verified ... audit events` دون طباعة المفتاح. أي نتيجة `HMAC mismatch` أو `previous_hash mismatch` تعني إيقاف الاعتماد المالي للسجل، حفظ نسخة للتحقيق، وعدم إعادة بناء السلسلة أو حذف الصفوف لإخفاء المشكلة.

## 11. اختبار العبث والاستعادة

في مشروع اختبار فقط، انسخ السجل إلى جدول تجريبي وغيّر قيمة `entry_hash` أو `canonical_payload` ثم شغّل أداة التحقق؛ يجب أن تفشل. لا تنفذ `UPDATE` أو `DELETE` على `public.audit_events` في الإنتاج. اختبر الأرشفة على مشروع تجريبي، ثم تحقق من أن `audit_events_archive` يحتفظ بالحمولة القانونية نفسها قبل اعتماد سياسة الاحتفاظ في الإنتاج.

## 12. تفعيل GitHub Actions

يحتوي المشروع على ثلاثة Workflows داخل `.github/workflows`: `ci.yml` للفحص على كل Pull Request وPush، و`deploy-supabase.yml` للنشر اليدوي أو عند إنشاء Tag يبدأ بـ `supabase-v`، و`audit-integrity.yml` للتحقق الدوري من سلسلة HMAC.

أنشئ Environment باسم `production` في إعدادات المستودع، وفَعّل **Required reviewers** قبل السماح بالنشر. أضف الأسرار التالية إلى Environment وليس إلى متغيرات عامة:

| Secret في GitHub | الاستخدام |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | مصادقة Supabase CLI للنشر |
| `SUPABASE_PROJECT_REF` | معرّف مشروع Supabase |
| `AUDIT_HMAC_KEY_B64` | مفتاح التحقق الحالي |
| `AUDIT_HMAC_KEY_ID` | إصدار المفتاح الحالي |
| `SMTP_PASSWORD` | سر SMTP الخادمي |
| `SUPABASE_URL` | يستخدمه فحص سلامة السجل الدوري |
| `SUPABASE_SERVICE_ROLE_KEY` | قراءة السجل للفحص الدوري فقط، ولا يستخدم في الواجهة |

بعد إضافة Secrets، شغّل `CI` تلقائياً عبر Pull Request. لا تسمح بدمج Pull Request إذا فشل `npm run verify` أو اختبارات HMAC أو فحص الأسرار. لتشغيل النشر، افتح **Actions → Deploy Supabase → Run workflow** واختر `staging` أو `production`. بيئة `production` يجب أن تتطلب موافقة مراجع قبل التنفيذ.

الفحص الدوري `Audit Integrity` يعمل أسبوعياً أو يدوياً. إذا ظهر `HMAC mismatch` أو `previous_hash mismatch`، أوقف النشر المالي، احتفظ بنسخة من السجل للتحقيق، ولا تعِد تشغيل Workflow بشكل أعمى؛ أصلح سبب الاختلاف أولاً.
