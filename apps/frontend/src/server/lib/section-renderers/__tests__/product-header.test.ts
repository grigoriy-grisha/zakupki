import { describe, expect,it } from 'vitest';

import { createMockProductHeader, renderById } from './test-setup';

describe('ProductHeaderRenderer', () => {
    it('prepends the bold name to the description HTML (normalized)', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: '<p>Свежий <b>болгарский</b> перец</p><p>Из Болгарии</p>',
            }),
        );
        expect(result).toBe('<b>Болгарский перец</b>\n\nСвежий <b>болгарский</b> перец\n\nИз Болгарии');
    });

    it('renders only the name when the description normalizes to empty HTML', () => {
        const result = renderById('PRODUCT_HEADER', createMockProductHeader({ description: '<p></p>' }));
        expect(result).toBe('<b>Болгарский перец</b>');
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
        expect(result).toBe('<b>Болгарский перец</b>\n\n<b>Заголовок</b>\nТекст с <i>курсивом</i>');
    });
});
