import { parseLayerName, ScraperSelector } from './layer-parser';

export interface ScraperLayer {
    node: SceneNode;
    selector: ScraperSelector;
}

export function findScraperLayers(nodes: readonly SceneNode[]): ScraperLayer[] {
    const scraperLayers: ScraperLayer[] = [];

    function traverse(node: SceneNode) {
        const parsed = parseLayerName(node.name);
        if (parsed) {
            scraperLayers.push({ node, selector: parsed });
        }

        if ('children' in node) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }

    for (const node of nodes) {
        traverse(node);
    }

    return scraperLayers;
}
