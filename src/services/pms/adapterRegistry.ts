// PMS Adapter Registry
// Returns the correct adapter for a given PMS type.

import type { PmsAdapter, PmsType } from '../../types/pms';
import { DentrixAscendAdapter } from './adapters/dentrixAscend';
import { GenericPmsAdapter } from './adapters/generic';

const genericAdapter = new GenericPmsAdapter();

const adapters: Record<PmsType, PmsAdapter> = {
  dentrix_ascend: new DentrixAscendAdapter(),
  open_dental: genericAdapter,    // Placeholder until specific adapter built
  eaglesoft: genericAdapter,      // Placeholder
  generic: genericAdapter,
};

export function getPmsAdapter(pmsType: PmsType): PmsAdapter {
  return adapters[pmsType] || adapters.generic;
}
