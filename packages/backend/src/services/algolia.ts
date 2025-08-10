import algoliasearch, { SearchIndex } from 'algoliasearch';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY; // Admin/write key for indexing
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'items';

let index: SearchIndex | null = null;

(() => {
  try {
    if (ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
      const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
      index = client.initIndex(ALGOLIA_INDEX_NAME);
      // Best-effort index settings
      index
        .setSettings({
          searchableAttributes: ['title'],
          removeWordsIfNoResults: 'allOptional',
          ignorePlurals: true
        })
        .catch((e) => console.warn('Algolia setSettings failed:', e));
      // eslint-disable-next-line no-console
      console.log(`Algolia initialized for index ${ALGOLIA_INDEX_NAME}`);
    } else {
      // eslint-disable-next-line no-console
      console.log('Algolia not configured (ALGOLIA_APP_ID/ALGOLIA_API_KEY missing)');
    }
  } catch (e) {
    console.warn('Algolia init failed:', e);
  }
})();

export const isAlgoliaEnabled = (): boolean => index != null;

export async function syncItemToAlgolia(id: string, data: any): Promise<void> {
  if (!index) return;
  try {
    await index.saveObject({ objectID: id, ...data });
  } catch (e) {
    console.warn('Algolia saveObject failed:', e);
  }
}

export async function deleteItemFromAlgolia(id: string): Promise<void> {
  if (!index) return;
  try {
    await index.deleteObject(id);
  } catch (e) {
    console.warn('Algolia deleteObject failed:', e);
  }
}

export async function searchAlgolia(query: string, hitsPerPage: number): Promise<Array<{ id: string; [key: string]: any }>> {
  if (!index) return [];
  const result = await index.search(query, { hitsPerPage });
  return (result.hits as any[]).map((hit) => {
    const { objectID, ...rest } = hit;
    return { id: objectID as string, ...rest };
  });
}


