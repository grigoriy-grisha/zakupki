# Refactoring Plan: Pricing & Supplement Logic

## Current State

Three files with mixed concerns:

- `pricing.ts` (216 lines): Order quantity validation, price calculation
- `pack-discount-pricing.ts` (64 lines): Supplier pack logic, unit detection
- `supplement-order.ts` (276 lines): Supplement/reorder logic

**Main problems:**

1. Fragile unit detection via string matching (`trim().toLowerCase().startsWith()`)
2. Unit logic scattered across files
3. Hard to maintain and extend

## Target Structure

```
shared/types/src/
├── units/
│   ├── index.ts                    # Public API
│   ├── types.ts                    # UnitType enum, interfaces
│   ├── detector.ts                 # Unit detection logic (replaces normalizeSupplierPackUnit)
│   └── constants.ts                # Unit-related constants
├── pricing/
│   ├── index.ts                    # Public API
│   ├── types.ts                    # PriceTier, OrderQuantityOptions
│   ├── calculation.ts              # calculateOrderAmount, roundMoney
│   ├── validation.ts               # getOrderQuantityValidationError, isValidOrderQuantity
│   ├── quantity-rules.ts           # getOrderQuantityStep, getMinOrderQuantity
│   └── formatting.ts               # formatMinPackageHint, formatMinPackageOrderHint
└── supplement/
    ├── index.ts                    # Public API
    ├── types.ts                    # SupplementLineState
    ├── phases.ts                   # PURCHASE_FULFILLMENT_STATUSES, phase checks
    ├── quantity-rules.ts           # getSupplementMinOrderQty, getSupplementEffectiveMinQty
    ├── remainder.ts                # getDisplayedSupplementRemainder, getSupplementMaxPacks
    ├── validation.ts               # getSupplementOrderValidationError, isValidSupplementOrder
    ├── snapping.ts                 # snapSupplementOrder
    └── formatting.ts               # formatSupplement* functions
```

## Implementation Steps

### Phase 1: Create Unit System (non-breaking)

1. Create `units/types.ts`:
    - `UnitType` enum: `GRAM`, `PIECE`, `TUBE`
    - `UnitInfo` interface with metadata

2. Create `units/detector.ts`:
    - `detectUnitType(raw: string): UnitType | null` - replaces `normalizeSupplierPackUnit()`
    - `isGramUnit(unit: UnitType): boolean`
    - `isPieceUnit(unit: UnitType): boolean`
    - Use centralized unit name mappings

3. Create `units/constants.ts`:
    - Unit name aliases and variations
    - Minimum order quantities per unit type

4. Create `units/index.ts`:
    - Export public API

### Phase 2: Refactor pack-discount-pricing.ts

1. Create `pricing/types.ts`:
    - Move `SupplierPackProductFields`, `PackDiscountPricingInfo`

2. Create `pricing/calculation.ts`:
    - Move `getSupplierPackSize()`, `countFullSupplierPacks()`, `getPackDiscountPricingInfo()`
    - Replace `normalizeSupplierPackUnit()` with `detectUnitType()`
    - Replace `isGramSupplierPackProduct()` with `isGramPackProduct()` using new unit system

3. Create `pricing/formatting.ts`:
    - Move `formatPackDiscountHint()`, `formatPackDiscountBanner()`

4. Create `pricing/index.ts`:
    - Export all pricing functions

5. Keep `pack-discount-pricing.ts` as re-export layer for backward compatibility

### Phase 3: Refactor pricing.ts

1. Move types to `pricing/types.ts`:
    - `PriceTier`, `CalculateOrderAmountOptions`, `OrderQuantityOptions`

2. Create `pricing/calculation.ts` (extend):
    - Move `calculateOrderAmount()`, `roundMoney()`, `parsePriceTiers()`

3. Create `pricing/quantity-rules.ts`:
    - Move `getOrderQuantityStep()`, `getMinOrderQuantity()`
    - Helper functions: `roundUpToStep()`, `isMultipleOf()`

4. Create `pricing/validation.ts`:
    - Move `getOrderQuantityValidationError()`, `isValidOrderQuantity()`, `snapOrderQuantity()`

5. Create `pricing/formatting.ts` (extend):
    - Move `formatMinPackageHint()`, `formatMinPackageOrderHint()`

6. Keep `pricing.ts` as re-export layer

### Phase 4: Refactor supplement-order.ts

1. Create `supplement/types.ts`:
    - Move `SupplementLineState`

2. Create `supplement/phases.ts`:
    - Move `PURCHASE_FULFILLMENT_STATUSES`, `PurchaseFulfillmentStatus`
    - Move `isSupplementRemainderOnlyPhase()`, `isSupplementPacksAllowed()`

3. Create `supplement/quantity-rules.ts`:
    - Move `SUPPLEMENT_MIN_ORDER_QTY`, `SUPPLEMENT_MIN_ORDER_QTY_PIECES`
    - Move `getSupplementMinOrderQty()`, `getSupplementEffectiveMinQty()`, `getSupplementUiOrderStep()`
    - **Replace `isPieceOrderUnit()` with `detectUnitType()` + `isPieceUnit()`**

4. Create `supplement/remainder.ts`:
    - Move `getDisplayedSupplementRemainder()`, `getSupplementMaxPacks()`

5. Create `supplement/validation.ts`:
    - Move `getSupplementOrderValidationError()`, `isValidSupplementOrder()`

6. Create `supplement/snapping.ts`:
    - Move `snapSupplementOrder()`

7. Create `supplement/formatting.ts`:
    - Move all `formatSupplement*` functions
    - Move `getSupplementRemainderStep()`

8. Create `supplement/index.ts`:
    - Export all supplement functions

9. Keep `supplement-order.ts` as re-export layer

### Phase 5: Update Main Index

1. Update `shared/types/src/index.ts`:
    - Import from new module structure
    - Maintain all existing exports for backward compatibility

### Phase 6: Testing & Validation

1. Run `pnpm typecheck` - ensure no type errors
2. Run `pnpm test` - ensure all tests pass
3. Run `pnpm lint` - ensure code style is correct
4. Manual verification:
    - Unit detection works for all variations (гр, g, gram, шт, piece, туба, tube)
    - Pricing calculations unchanged
    - Supplement validation unchanged

## Key Improvements

1. **Type-safe units**: Enum instead of string matching
2. **Centralized logic**: Unit detection in one place
3. **Better organization**: Each file has single responsibility
4. **Easier testing**: Can test unit detection independently
5. **Easier extension**: Adding new unit types is straightforward
6. **Backward compatible**: Old imports still work via re-exports

## Migration Strategy

- Keep old files as re-export layers
- Gradually migrate imports in consuming code
- Eventually remove re-export layers after full migration

## Files to Create

**New files (15 total):**

- `units/types.ts`
- `units/detector.ts`
- `units/constants.ts`
- `units/index.ts`
- `pricing/types.ts`
- `pricing/calculation.ts`
- `pricing/quantity-rules.ts`
- `pricing/validation.ts`
- `pricing/formatting.ts`
- `pricing/index.ts`
- `supplement/types.ts`
- `supplement/phases.ts`
- `supplement/quantity-rules.ts`
- `supplement/remainder.ts`
- `supplement/validation.ts`
- `supplement/snapping.ts`
- `supplement/formatting.ts`
- `supplement/index.ts`

**Files to modify (4 total):**

- `pack-discount-pricing.ts` → re-export layer
- `pricing.ts` → re-export layer
- `supplement-order.ts` → re-export layer
- `index.ts` → update imports

**Files to delete (0):**

- None initially (re-export layers maintain compatibility)
