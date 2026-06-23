import useSWR from 'swr';

const fetcher = (url: string): Promise<Measure[]> => fetch(url).then((r) => r.json());

// Measures are static reference data; SWR dedupes this across every component that
// calls the hook, so it's effectively fetched once per page regardless of how many
// places need to resolve a measureId to its display strings.
export function useMeasures(): Measure[] {
  const { data } = useSWR<Measure[]>('/api/measures', fetcher);
  return data ?? [];
}

export function findMeasure(measureId: string, measures: Measure[]): Measure | undefined {
  return measures.find((m) => m.measureId === measureId);
}
