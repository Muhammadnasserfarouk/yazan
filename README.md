# نوم يزن

تطبيق ويب (PWA) لمتابعة نوم يزن: نوم الليل، والقيلولات، ومرات الصحيان، والإجمالي اليومي، مع تحليل مناسب لسنّه وتذكير بمواعيد العلاج.
الأب والأم بيعملوا حسابين، وبيشوفوا نفس البيانات في نفس اللحظة. التطبيق بيشتغل من غير نت، وبيرفع البيانات لما النت يرجع.

## تجهيز Firebase (مرة واحدة)
1. ادخل على https://console.firebase.google.com ← **Create a project** ← سمّيه `yazan` (Google Analytics مش لازم).
2. **Build ← Authentication ← Get started ← Email/Password ← Enable ← Save**.
3. **Authentication ← Settings ← Authorized domains ← Add domain**: `muhammadnasserfarouk.github.io`.
4. **Build ← Firestore Database ← Create database** ← اختار أقرب location (مثلاً `eur3`) ← **Start in production mode**.
5. **Firestore ← Rules**: امسح الموجود، والزق محتوى ملف [`firestore.rules`](firestore.rules)، ودوس **Publish**.
6. **Project settings (الترس) ← Your apps ← أيقونة الويب `</>`** ← سمّيه `yazan` ← **Register app**، وانسخ `firebaseConfig`.
7. حط القيم في [`js/config.js`](js/config.js) بدل `null`.

## التثبيت على الآيفون
1. افتح https://muhammadnasserfarouk.github.io/yazan/ من Safari.
2. زرار المشاركة ← «إضافة إلى الشاشة الرئيسية».
3. اعمل حساب ← «سجّل بيانات الطفل». بعدها ابعت كود العيلة من «الإعدادات» لمراتك، وهي تختار «عندي كود من شريكي».

## الملفات
| الملف | الدور |
|---|---|
| `index.html` | الصفحة الأساسية |
| `css/app.css` | الشكل والألوان |
| `js/app.js` | حالة التطبيق والشاشات والأحداث |
| `js/views.js` | بناء كل شاشة |
| `js/sleep.js` | حسابات النوم والتحليل (من غير أي اتصال) |
| `js/db.js` | الحسابات والبيانات على Firebase |
| `js/util.js` | أدوات مشتركة (وقت، تنسيق) |
| `js/config.js` | إعداد Firebase |
| `firestore.rules` | مين يقدر يقرا ويكتب إيه |
| `sw.js` | الشغل من غير نت |

لما تعدّل أي ملف، غيّر `VERSION` في `sw.js` عشان الموبايل ياخد النسخة الجديدة.
