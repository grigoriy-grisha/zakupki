import { describe, expect,it } from 'vitest';

import { createMockProductHeader, renderById } from './test-setup';

describe('ProductHeaderRenderer', () => {
    it('renders only the description HTML without a forced name line', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                description: '<p>Свежий <b>болгарский</b> перец</p><p>Из Болгарии</p>',
            }),
        );
        expect(result).toBe('Свежий <b>болгарский</b> перец\n\nИз Болгарии');
    });

    it('renders only the description when the name is empty', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({ name: '', description: '<p>Только описание</p>' }),
        );
        expect(result).toBe('Только описание');
    });

    it('renders null when the description normalizes to empty HTML (template produced nothing)', () => {
        const result = renderById('PRODUCT_HEADER', createMockProductHeader({ description: '<p></p>' }));
        expect(result).toBeNull();
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

    it('renders null when name is empty and description null and no minPackage/price', () => {
        const result = renderById(
            'PRODUCT_HEADER',
            createMockProductHeader({
                name: '   ',
                description: null,
                minPackageAmount: null,
                minPackageUnit: null,
                unitPriceRub: 0,
            }),
        );
        expect(result).toBeNull();
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
        expect(result).toBe('<b>Заголовок</b>\nТекст с <i>курсивом</i>');
    });
});
