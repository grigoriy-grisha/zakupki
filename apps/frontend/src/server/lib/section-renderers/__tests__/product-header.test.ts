import { describe, it, expect } from 'vitest';

import { createMockProductHeader, renderById } from './test-setup';

describe('ProductHeaderRenderer', () => {
    it('renders description HTML when present (with normalization)', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: '<p>Свежий <b>болгарский</b> перец</p><p>Из Болгарии</p>',
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('renders name + minPackage + price when description is null', () => {
        const result = renderById('PRODUCT_HEADER', createMockProductHeader({ description: null }));
        expect(result).toMatchSnapshot();
    });

    it('renders only name when description null and no minPackage', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                unitPriceRub: 0,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('uses unit shortName from unitCode lookup', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                unitCode: 'kg',
                unitPriceRub: 100,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('falls back to "ед." when unitCode is unknown', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                unitCode: 'BOGUS',
                unitPriceRub: 100,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('escapes HTML in name (safety)', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                name: '<script>alert(1)</script>',
                unitPriceRub: 0,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('formats price with ru-RU separators', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                unitPriceRub: 1234567.89,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('normalizes <br> and <strong> in description HTML', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: '<strong>Заголовок</strong><br>Текст с <em>курсивом</em>',
            }),
        );
        expect(result).toMatchSnapshot();
    });
});
