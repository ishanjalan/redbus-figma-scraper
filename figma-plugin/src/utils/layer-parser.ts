export interface ScraperSelector {
    selector: string;
    modifier?: string;
    attribute?: string;
    groupIndex?: number; // For .group[N] modifier - defines scope index
}

export function parseLayerName(name: string): ScraperSelector | null {
    // Pattern: @{css-selector}[.modifier] or @{css-selector}[.modifier[index]] or @{css-selector}[.attr(name)]
    // Examples:
    //   @{h1}                    -> selector: "h1"
    //   @{.price}.all            -> selector: ".price", modifier: "all"
    //   @{.container}.group[0]   -> selector: ".container", modifier: "group", groupIndex: 0
    //   @{a}.attr(href)          -> selector: "a", modifier: "attr", attribute: "href"
    
    const regex = /@\{([^}]+)\}(?:\.([a-zA-Z0-9_]+)(?:\[(\d+)\]|\(([^)]+)\))?)?/;
    const match = name.match(regex);

    if (!match) return null;

    const selector = match[1].trim();
    const modifier = match[2];
    const indexOrAttr = match[3]; // Could be group index [N] or undefined
    const attribute = match[4];   // For attr(name) pattern

    const result: ScraperSelector = {
        selector,
        modifier,
        attribute,
    };

    // If we have a number in brackets and modifier is "group", set groupIndex
    if (indexOrAttr !== undefined && modifier === 'group') {
        result.groupIndex = parseInt(indexOrAttr, 10);
    }

    return result;
}

/**
 * Check if a selector has a group modifier (defines a scope for children)
 */
export function isGroupSelector(parsed: ScraperSelector | null): boolean {
    return parsed !== null && parsed.modifier === 'group' && parsed.groupIndex !== undefined;
}

/**
 * Build a scoped selector by combining parent's indexed selector with child's selector
 * Example: parent ".item" with index 2, child ".name" -> ".item:nth-of-type(3) .name"
 */
export function buildScopedSelector(
    parentSelector: string,
    parentIndex: number,
    childSelector: string
): string {
    // nth-of-type is 1-indexed, so add 1 to the 0-based index
    return `${parentSelector}:nth-of-type(${parentIndex + 1}) ${childSelector}`;
}
