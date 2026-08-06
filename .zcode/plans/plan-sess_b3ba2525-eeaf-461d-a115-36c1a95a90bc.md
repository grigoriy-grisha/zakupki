## План: Галерея фото товара с лайтбоксом и навигацией

### Контекст (из исследования)
- Данные: `Product.photos: { id, sortOrder }[]` — массив, отсортированный по `sortOrder`. URL = `/api/photos/{id}`.
- Сейчас `ProductPhotoPreview` принимает **один** `photoId`. Все 11 мест вызова передают `photos[0]`. Остальные фото не видны нигде.
- Анимации — только CSS (`tw-animate-css` + кастомные keyframes в `globals.css`). framer-motion/embla **не** установлены.

### Что делаю

#### 1. Расширить `components/shared/product-photo-preview.tsx`
- Добавить опциональный проп `photoIds?: number[]` (массив всех фото). Если передан — лайтбокс становится галереей; `photoId` используется как стартовое/обложечное.
- Если `photoIds` не передан — обратно-совместимое поведение (одно фото, как сейчас).
- **Лайтбокс с навигацией:**
  - Кнопки **← →** по бокам (полупрозрачные круглые, как текущая кнопка закрытия)
  - **Свайпы** пальцем (touch events: `touchstart`/`touchend`, порог 50px) — важно для Mini App
  - **Клавиатура** ← → для десктопа, Escape — закрыть (уже есть)
  - **Превью снизу** — горизонтальный скролл миниатюр, тык → переход к фото. Активное подсвечено.
  - **Счётчик** «2 / 5» сверху-слева
  - **Анимация перехода** — через CSS keyframe `slide-in-from-left/right` (уже доступен из `tw-animate-css`) + opacity crossfade
  - Клик по затемнённому фону — закрыть; клик по фото — `stopPropagation`
  - Предзагрузка соседних фото (`<link rel="preload">` или скрытый `<img>` для next/prev)

#### 2. Создать переиспользуемый хук `lib/hooks/use-lightbox-gallery.ts`
- Инкапсулирует логику: `currentIndex`, `next()`, `prev()`, `goTo(i)`, обработка свайпов, клавиатуры.
- Чистые функции, легко тестировать.

#### 3. Обновить места вызова — передавать все фото

**Shop (клиентская часть):**
- `app/shop/purchase/[id]/components/product-card.tsx:152` — `photoIds={product.photos?.map(p => p.id)}`
- `app/shop/purchase/[id]/item/[itemId]/page.tsx:233` — то же + (опц.) мини-галерея превью под большой фотой

**Admin (все места с ProductPhotoPreview):**
- `app/(admin)/purchases/[id]/components/items/items-table-row.tsx:211`
- `app/(admin)/purchases/[id]/components/packing/packing-item-card.tsx:87`
- `app/(admin)/purchases/[id]/components/participants/participant-orders-panel.tsx:86`
- `app/(admin)/purchases/[id]/components/supplements/supplement-dialog.tsx:116`

**Каталог админа (card thumbnail — сейчас обычный `<img>`):**
- `app/(admin)/products/components/product-card.tsx:71` — обернуть в `ProductPhotoPreview` с массивом фото
- `app/(admin)/purchases/[id]/components/items/product-picker-dialog.tsx:179`

**Мои заказы:**
- `app/shop/orders/page.tsx:122` — обернуть в `ProductPhotoPreview`

#### 4. Анимация
- Без новых зависимостей. Использую существующие CSS-утилиты:
  - `animate-in slide-in-from-right-5` / `slide-in-from-left-5` при смене фото
  - `data-[state=open]:zoom-in-100` для открытия (уже есть)
- Добавлю keyframe `@keyframes lightbox-slide` в `globals.css` если стандартных утилит не хватит для плавного crossfade.

### Файлы
**Новые:**
- `apps/frontend/src/lib/hooks/use-lightbox-gallery.ts` — логика навигации/свайпов/клавиатуры

**Изменяемые:**
- `apps/frontend/src/components/shared/product-photo-preview.tsx` — галерея в лайтбоксе
- `apps/frontend/src/app/shop/purchase/[id]/components/product-card.tsx` — photoIds
- `apps/frontend/src/app/shop/purchase/[id]/item/[itemId]/page.tsx` — photoIds + опц. мини-превью
- `apps/frontend/src/app/(admin)/purchases/[id]/components/items/items-table-row.tsx`
- `apps/frontend/src/app/(admin)/purchases/[id]/components/packing/packing-item-card.tsx`
- `apps/frontend/src/app/(admin)/purchases/[id]/components/participants/participant-orders-panel.tsx`
- `apps/frontend/src/app/(admin)/purchases/[id]/components/supplements/supplement-dialog.tsx`
- `apps/frontend/src/app/(admin)/products/components/product-card.tsx` — обернуть в ProductPhotoPreview
- `apps/frontend/src/app/(admin)/purchases/[id]/components/items/product-picker-dialog.tsx`
- `apps/frontend/src/app/shop/orders/page.tsx`
- `apps/frontend/src/app/globals.css` — опц. keyframes (если нужно)

### Проверка
- `pnpm typecheck` (Node 22 через nvm)
- Коммит + push → CI сборка → деплой
- Ручная проверка в Mini App и браузере