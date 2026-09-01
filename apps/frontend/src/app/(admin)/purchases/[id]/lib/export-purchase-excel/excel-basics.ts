import type ExcelJS from 'exceljs';

import { type AttributeTypeMeta, formatPurchaseProductLabel } from '@/lib/product-label';

import type { ExportProduct } from './types';

const excelThinBorder: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: 'FF000000' },
};

const excelCellBorders: Partial<ExcelJS.Borders> = {
    top: excelThinBorder,
    left: excelThinBorder,
    bottom: excelThinBorder,
    right: excelThinBorder,
};

export function applyCellBorder(cell: ExcelJS.Cell) {
    cell.border = excelCellBorders;
}

export function applySheetBorders(
    sheet: ExcelJS.Worksheet,
    fromRow: number,
    toRow: number,
    fromCol: number,
    toCol: number,
) {
    for (let rowNumber = fromRow; rowNumber <= toRow; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        for (let col = fromCol; col <= toCol; col++) {
            applyCellBorder(row.getCell(col));
        }
    }
}

export function styleNumericCell(cell: ExcelJS.Cell) {
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

export function styleHeaderCell(cell: ExcelJS.Cell) {
    cell.font = { bold: true };
}

export function styleFixedColumnCell(cell: ExcelJS.Cell, columnIndex: number) {
    if (columnIndex === 1) {
        cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
        };
        return;
    }
    if (columnIndex >= 3) {
        styleNumericCell(cell);
        return;
    }
    cell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
    };
}

export function applyOrdersCellFill(cell: ExcelJS.Cell, fillArgb: string) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillArgb },
    };
}

export function formatMoney(value: unknown) {
    return Number(value);
}

export function safeFilename(tag: string, suffix: string) {
    const base = tag.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
    const date = new Date().toISOString().slice(0, 10);
    return `${base}_${suffix}_${date}.xlsx`;
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export { downloadWorkbook };

function excelProductNameLines(product: ExportProduct, attributeTypes?: AttributeTypeMeta[]) {
    const label = formatPurchaseProductLabel(product, undefined, attributeTypes);
    return { line1: label.line1, line2: label.line2 };
}

export function setExcelProductNameCell(
    cell: ExcelJS.Cell,
    product: ExportProduct | undefined,
    attributeTypes?: AttributeTypeMeta[],
) {
    cell.alignment = { horizontal: 'left', wrapText: true, vertical: 'middle' };
    if (!product) return;

    const { line1, line2 } = excelProductNameLines(product, attributeTypes);
    if (!line1 && !line2) {
        cell.value = product.name;
        return;
    }

    const richText: ExcelJS.RichText[] = [];
    if (line1) {
        richText.push({ text: line1.replace(/ /g, '\u00A0'), font: { bold: true } });
    }
    if (line2) {
        if (line1) {
            richText.push({ text: '\n', font: { bold: true } });
        }
        richText.push({ text: line2, font: { size: 9 } });
    }

    cell.value = { richText };
}
