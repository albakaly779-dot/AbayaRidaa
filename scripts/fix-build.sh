#!/usr/bin/env bash
# ========================================================================
# fix-build.sh — إصلاح مشكلة صلاحيات esbuild وإعادة تجهيز البيئة
# ========================================================================
#
# المشكلة: fork/exec node_modules/.bin/esbuild: permission denied
# السبب: الملف الثنائي لـ esbuild لا يمتلك bit التنفيذ (+x).
#         يحدث عند نسخ node_modules عبر tarball/zip أو تشغيل npm install
#         من داخل حاوية بدون صلاحيات Unix صحيحة.
#
# استخدام:
#   bash scripts/fix-build.sh          # إصلاح سريع (chmod فقط)
#   bash scripts/fix-build.sh --clean  # إصلاح شامل (حذف + إعادة تثبيت)
# ========================================================================

set -e

CLEAN_MODE=false
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
  CLEAN_MODE=true
fi

echo "🔧 AbayaRidaa Build Fix Script"
echo "================================"

if [ "$CLEAN_MODE" = true ]; then
  echo "🧹 وضع التنظيف الشامل مفعّل"
  echo ""

  echo "  → حذف node_modules..."
  rm -rf node_modules

  echo "  → حذف package-lock.json..."
  rm -f package-lock.json

  echo "  → إعادة تثبيت الحزم (قد يستغرق دقائق)..."
  npm install

  echo ""
  echo "✅ تم إعادة التثبيت الكامل"
else
  echo "⚡ وضع الإصلاح السريع"
  echo ""

  if [ ! -d "node_modules/.bin" ]; then
    echo "❌ node_modules/.bin غير موجود — نفّذ: npm install أولاً"
    exit 1
  fi

  echo "  → تفعيل bit التنفيذ لجميع ملفات .bin..."
  chmod +x node_modules/.bin/* 2>/dev/null || true

  # Ensure esbuild's platform-specific binaries are also executable
  for platform_dir in node_modules/@esbuild/*/bin; do
    if [ -d "$platform_dir" ]; then
      chmod +x "$platform_dir"/* 2>/dev/null || true
      echo "    ✓ $platform_dir"
    fi
  done

  echo ""
  echo "✅ تم إصلاح الصلاحيات"
fi

echo ""
echo "🧪 اختبار esbuild..."
if node_modules/.bin/esbuild --version >/dev/null 2>&1; then
  VER=$(node_modules/.bin/esbuild --version)
  echo "  ✓ esbuild يعمل بشكل صحيح (v$VER)"
else
  echo "  ❌ esbuild ما زال معطّلاً — جرّب: bash scripts/fix-build.sh --clean"
  exit 1
fi

echo ""
echo "🏗️  اختبار البناء..."
if npm run build 2>&1 | tail -20; then
  echo ""
  echo "🎉 البناء نجح! يمكنك الآن نشر المشروع"
else
  echo ""
  echo "⚠️  فشل البناء — راجع الأخطاء أعلاه"
  exit 1
fi
