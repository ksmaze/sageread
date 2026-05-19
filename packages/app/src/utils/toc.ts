import { type BookDoc, CFI, type SectionItem, type TOCItem } from "@/lib/document";

export const findParentPath = (toc: TOCItem[], href: string): TOCItem[] => {
  for (const item of toc) {
    if (item.href === href) {
      return [item];
    }
    if (item.subitems) {
      const path = findParentPath(item.subitems, href);
      if (path.length) {
        return [item, ...path];
      }
    }
  }
  return [];
};

export const findTocItemBS = (toc: TOCItem[], cfi: string): TOCItem | null => {
  let left = 0;
  let right = toc.length - 1;
  let result: TOCItem | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const currentCfi = toc[mid]!.cfi || "";
    const comparison = CFI.compare(currentCfi, cfi);
    if (comparison === 0) {
      return toc[mid]!;
    } else if (comparison < 0) {
      result = toc[mid]!;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
};

export const updateToc = async (bookDoc: BookDoc, sortedTOC: boolean): Promise<void> => {
  const items = bookDoc?.toc || [];
  const sections = bookDoc?.sections || [];
  if (!items.length || !sections.length) return;

  const sizes = sections.map((s) => (s.linear !== "no" && s.size > 0 ? s.size : 0));
  let cumulativeSize = 0;
  const cumulativeSizes = sizes.reduce((acc: number[], size) => {
    acc.push(cumulativeSize);
    cumulativeSize += size;
    return acc;
  }, []);
  const totalSize = cumulativeSizes[cumulativeSizes.length - 1] || 0;
  const sizePerLoc = 1500;
  sections.forEach((section, index) => {
    section.location = {
      current: Math.floor(cumulativeSizes[index]! / sizePerLoc),
      next: Math.floor((cumulativeSizes[index]! + sizes[index]!) / sizePerLoc),
      total: Math.floor(totalSize / sizePerLoc),
    };
  });

  const sectionsMap = sections.reduce((map: Record<string, SectionItem>, section) => {
    map[String(section.id)] = section;
    return map;
  }, {});

  await updateTocData(bookDoc, items, sectionsMap);

  if (sortedTOC) {
    sortTocItems(items);
  }
};

const updateTocData = async (
  bookDoc: BookDoc,
  items: TOCItem[],
  sectionsMap: { [id: string]: SectionItem },
  index = 0,
): Promise<number> => {
  for (const item of items) {
    item.id ??= index++;
    if (item.href) {
      const [id] = await Promise.resolve(bookDoc.splitTOCHref(item.href));
      const section = id === null || id === undefined ? undefined : sectionsMap[String(id)];
      if (section) {
        if (section.cfi) {
          item.cfi = section.cfi;
        }
        // Add location only when toc item is at the same level as the section
        // otherwise the location will not be accurate
        if (String(id) === item.href || items.length <= Object.keys(sectionsMap).length) {
          item.location = section.location;
        }
      }
    }
    if (item.subitems) {
      index = await updateTocData(bookDoc, item.subitems, sectionsMap, index);
    }
  }
  return index;
};

const sortTocItems = (items: TOCItem[]): void => {
  items.sort((a, b) => {
    if (a.location && b.location) {
      return a.location.current - b.location.current;
    }
    return 0;
  });
};
