import { formatActiveStepHint } from '@zakupki/types';

export interface StepHintSource {
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplementStep?: string | number | null;
}

export function buildStepHint(
    item: StepHintSource,
    fulfillmentStatus: string,
    unitShort: string,
    unitCode?: string | null,
): string | null {
    return formatActiveStepHint({
        fulfillmentStatus,
        minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
        minPackageUnit: item.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        unitShort,
        unitCode: unitCode ?? null,
    });
}
