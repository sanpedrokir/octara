import fs from 'fs';
import path from 'path';
import type { SsgCourse } from './types';

interface CatalogEntry {
  r: string; // referenceNumber
  t: string; // title
  p: string; // provider alias
  f: number; // full fee
  s: number; // subsidised fee
  h: number; // hours
}

let _catalog: CatalogEntry[] | null = null;

function getCatalog(): CatalogEntry[] {
  if (_catalog) return _catalog;
  const filePath = path.join(process.cwd(), 'data', 'sf-courses.json');
  if (!fs.existsSync(filePath)) return [];
  _catalog = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CatalogEntry[];
  return _catalog;
}

export function searchLocalCatalog(keyword: string, limit = 10): SsgCourse[] {
  const catalog = getCatalog();
  if (!catalog.length) return [];

  const kw = keyword.toLowerCase();
  const results: SsgCourse[] = [];

  for (const c of catalog) {
    if (c.t.toLowerCase().includes(kw) || c.p.toLowerCase().includes(kw)) {
      results.push({
        referenceNumber: c.r,
        title: c.t,
        providerName: c.p,
        totalCostOfTrainingPerTrainee: c.f,
        subsidisedFee: c.s,
        url: `https://courses.myskillsfuture.gov.sg/courses/${encodeURIComponent(c.r)}`,
        category: '',
        modeOfTraining: '',
        duration: c.h > 0 ? `${c.h} hrs` : '',
      });
      if (results.length >= limit) break;
    }
  }

  return results;
}

export function getCatalogSize(): number {
  return getCatalog().length;
}
