import { backendFetch } from '@/lib/backend';

export async function fetchMeasures(): Promise<Measure[]> {
  const response = await backendFetch('/api/measures');
  if (!response.ok) {
    throw new Error(`Failed to fetch measures: ${response.status}`);
  }
  return response.json();
}

export function toMeasure(measureId: string, measures: Measure[]): Measure {
  const measure = measures.find((m) => m.measureId === measureId);
  if (!measure) throw new Error(`Unknown measure: ${measureId}`);
  return measure;
}

export async function fetchMeasureById(measureId: string): Promise<Measure> {
  const response = await backendFetch(`/api/measures/${measureId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch measure '${measureId}': ${response.status}`);
  }
  return response.json();
}
