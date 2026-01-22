import { findScraperLayers, ScraperLayer } from './utils/layer-finder';
import { isGroupSelector } from './utils/layer-parser';
import {
    UIToCodeMessage,
    CodeToUIMessage,
    SyncScope,
    SelectorRequest,
    DetectedLayer,
    ScrapeResult,
} from './types/messages';

// Show UI with larger window for better UX
figma.showUI(__html__, { width: 420, height: 600, themeColors: true });

// Helper to send messages to UI
function postToUI(message: CodeToUIMessage): void {
    figma.ui.postMessage(message);
}

// Get nodes based on scope
function getNodesForScope(scope: SyncScope): readonly SceneNode[] {
    switch (scope) {
        case 'document':
            return figma.root.children.flatMap((page) => page.children);
        case 'page':
            return figma.currentPage.children;
        case 'selection':
        default:
            return figma.currentPage.selection.length > 0
                ? figma.currentPage.selection
                : figma.currentPage.children;
    }
}

// Convert ScraperLayer to DetectedLayer for UI
function toDetectedLayer(layer: ScraperLayer): DetectedLayer {
    const isImageNode = 
        layer.node.type === 'RECTANGLE' || 
        layer.node.type === 'ELLIPSE' || 
        layer.node.type === 'POLYGON' ||
        layer.node.type === 'FRAME' ||
        layer.node.type === 'INSTANCE' ||
        layer.node.type === 'COMPONENT';

    // Extract description from layer name (text before @{)
    const nameMatch = layer.node.name.match(/^(.*?)@\{/);
    const description = nameMatch ? nameMatch[1].trim() : '';

    // Include group index in the display if present
    let modifierDisplay = layer.selector.modifier;
    if (layer.selector.modifier === 'group' && layer.selector.groupIndex !== undefined) {
        modifierDisplay = `group[${layer.selector.groupIndex}]`;
    }

    return {
        id: layer.node.id,
        name: description || layer.selector.selector,
        selector: layer.selector.selector,
        type: isImageNode ? 'image' : 'text',
        modifier: modifierDisplay,
    };
}

// Find the parent group context for a layer (if any)
// Returns the groupIndex that children should use for indexed extraction
function findParentGroupIndex(
    layer: ScraperLayer,
    allLayers: ScraperLayer[]
): number | undefined {
    let parent = layer.node.parent;
    
    while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
        // Check if this parent has a .group[N] selector
        const parentLayer = allLayers.find(
            (l) => l.node.id === parent!.id && isGroupSelector(l.selector)
        );
        
        if (parentLayer && parentLayer.selector.groupIndex !== undefined) {
            return parentLayer.selector.groupIndex;
        }
        
        parent = parent.parent;
    }
    
    return undefined;
}

// Build full selector for legacy .all parent context
function buildFullSelector(layer: ScraperLayer, allLayers: ScraperLayer[]): string {
    let finalSelector = layer.selector.selector;

    // Look for .all parent context (legacy behavior)
    let parent = layer.node.parent;
    while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
        const parentLayer = allLayers.find(
            (l) => l.node.id === parent!.id && l.selector.modifier === 'all'
        );
        if (parentLayer) {
            finalSelector = `${parentLayer.selector.selector} ${finalSelector}`;
        }
        parent = parent.parent;
    }

    return finalSelector;
}

// Check if a layer is a group container (should not be sent as a selector itself)
function isGroupContainer(layer: ScraperLayer): boolean {
    return isGroupSelector(layer.selector);
}

// Message handler
figma.ui.onmessage = async (msg: UIToCodeMessage) => {
    // Handle scan-layers request
    if (msg.type === 'scan-layers') {
        const nodes = getNodesForScope(msg.scope);
        const scraperLayers = findScraperLayers(nodes);
        const detectedLayers = scraperLayers.map(toDetectedLayer);

        postToUI({ type: 'layers-found', layers: detectedLayers });
        return;
    }

    // Handle sync request
    if (msg.type === 'sync') {
        const { url, scope, options } = msg;
        const nodes = getNodesForScope(scope);
        const scraperLayers = findScraperLayers(nodes);

        if (scraperLayers.length === 0) {
            postToUI({ 
                type: 'error', 
                message: 'No @{selector} layers found in the selected scope' 
            });
            return;
        }

        // Build selector requests, filtering out group containers
        // Group containers are just scope definitions, not data extraction targets
        const selectors: SelectorRequest[] = scraperLayers
            .filter((layer) => !isGroupContainer(layer))
            .map((layer) => {
                const isImageNode = 
                    layer.node.type === 'RECTANGLE' || 
                    layer.node.type === 'ELLIPSE' || 
                    layer.node.type === 'POLYGON' ||
                    layer.node.type === 'FRAME' ||
                    layer.node.type === 'INSTANCE' ||
                    layer.node.type === 'COMPONENT';

                // Check if this layer is inside a .group[N] parent
                const parentIndex = findParentGroupIndex(layer, scraperLayers);

                return {
                    id: layer.node.id,
                    selector: buildFullSelector(layer, scraperLayers),
                    type: isImageNode ? 'image' : 'text',
                    modifier: layer.selector.modifier,
                    attribute: layer.selector.attribute,
                    index: parentIndex, // Pass the parent's group index for indexed extraction
                };
            });

        if (selectors.length === 0) {
            postToUI({ 
                type: 'error', 
                message: 'No data layers found. Group containers need child layers with @{selector} to extract data.' 
            });
            return;
        }

        // Send to UI to fetch data from API
        postToUI({
            type: 'fetch-data',
            url,
            selectors,
        });
        return;
    }

    // Handle apply-data from UI
    if (msg.type === 'apply-data') {
        const { results } = msg;
        let updated = 0;
        let failed = 0;

        postToUI({ type: 'progress', current: 0, total: results.length, message: 'Applying data to layers...' });

        for (let i = 0; i < results.length; i++) {
            const result = results[i] as ScrapeResult;
            
            try {
                let node: SceneNode | null = null;

                if (result.originalId !== undefined && result.index !== undefined) {
                    // This is a repeated item from .all modifier
                    const originalNode = figma.getNodeById(result.originalId) as SceneNode;
                    if (!originalNode || !originalNode.parent) {
                        failed++;
                        continue;
                    }

                    if (result.index === 0) {
                        node = originalNode;
                    } else {
                        // Clone the original node for subsequent items
                        node = originalNode.clone();
                        
                        // Position it based on the original node's layout
                        if ('layoutMode' in originalNode.parent && originalNode.parent.layoutMode !== 'NONE') {
                            // Auto-layout will handle positioning
                        } else {
                            // Manual positioning: stack vertically
                            const offset = result.index * (originalNode.height + 16);
                            node.y = originalNode.y + offset;
                        }
                    }
                } else {
                    node = figma.getNodeById(result.id) as SceneNode;
                }

                if (!node) {
                    failed++;
                    continue;
                }

                if (result.found && result.data) {
                    if (result.type === 'text' && node.type === 'TEXT') {
                        // Load font before setting text
                        const fontName = node.fontName as FontName;
                        await figma.loadFontAsync(fontName);
                        node.characters = result.data;
                        updated++;
                    } else if (result.type === 'image' && result.bytes) {
                        // Create image from bytes
                        const image = figma.createImage(result.bytes);
                        const fill: ImagePaint = {
                            type: 'IMAGE',
                            scaleMode: 'FILL',
                            imageHash: image.hash,
                        };

                        if ('fills' in node) {
                            node.fills = [fill];
                            updated++;
                        } else {
                            failed++;
                        }
                    } else if (result.type === 'text' && result.data) {
                        // Handle non-text nodes that should display text
                        // (could be in a frame or other container)
                        const textNode = findTextInNode(node);
                        if (textNode) {
                            const fontName = textNode.fontName as FontName;
                            await figma.loadFontAsync(fontName);
                            textNode.characters = result.data;
                            updated++;
                        } else {
                            failed++;
                        }
                    } else {
                        failed++;
                    }
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Error applying result:', error);
                failed++;
            }

            // Update progress
            postToUI({ 
                type: 'progress', 
                current: i + 1, 
                total: results.length, 
                message: `Applied ${i + 1}/${results.length} layers` 
            });
        }

        postToUI({ type: 'sync-complete', updated, failed });
    }

    // Handle apply-datalayer from UI (DataLayer mode)
    if (msg.type === 'apply-datalayer') {
        const { items, scope } = msg;
        
        try {
            postToUI({ type: 'progress', current: 0, total: items.length, message: 'Applying data to frames...' });
            
            const { updated, failed } = await applyDataLayerItems(items, scope);
            
            postToUI({ type: 'sync-complete', updated, failed });
        } catch (error: any) {
            postToUI({ type: 'error', message: error.message || 'Failed to apply data' });
        }
    }
};

// Helper to find text node within a container
function findTextInNode(node: SceneNode): TextNode | null {
    if (node.type === 'TEXT') {
        return node;
    }
    if ('children' in node) {
        for (const child of node.children) {
            const found = findTextInNode(child);
            if (found) return found;
        }
    }
    return null;
}

// Helper to parse @[N] index from frame name
function parseFrameIndex(name: string): number | null {
    const match = name.match(/@\[(\d+)\]/);
    return match ? parseInt(match[1], 10) : null;
}

// Helper to parse @{fieldName} from layer name
function parseFieldName(name: string): string | null {
    const match = name.match(/@\{([^}]+)\}/);
    return match ? match[1] : null;
}

// Find all indexed frames (Card @[0], Card @[1], etc.) in a scope
function findIndexedFrames(nodes: readonly SceneNode[]): Map<number, SceneNode> {
    const frames = new Map<number, SceneNode>();
    
    function searchNode(node: SceneNode) {
        const index = parseFrameIndex(node.name);
        if (index !== null) {
            frames.set(index, node);
        }
        
        if ('children' in node) {
            for (const child of node.children) {
                searchNode(child);
            }
        }
    }
    
    for (const node of nodes) {
        searchNode(node);
    }
    
    return frames;
}

// Find field layers within a frame (layers named @{fieldName})
function findFieldLayers(node: SceneNode): Map<string, SceneNode> {
    const fields = new Map<string, SceneNode>();
    
    function searchNode(n: SceneNode) {
        const fieldName = parseFieldName(n.name);
        if (fieldName) {
            fields.set(fieldName, n);
        }
        
        if ('children' in n) {
            for (const child of n.children) {
                searchNode(child);
            }
        }
    }
    
    searchNode(node);
    return fields;
}

// Handle apply-datalayer message
async function applyDataLayerItems(
    items: Record<string, any>[],
    scope: SyncScope
): Promise<{ updated: number; failed: number }> {
    const nodes = getNodesForScope(scope);
    const indexedFrames = findIndexedFrames(nodes);
    
    let updated = 0;
    let failed = 0;
    
    // Apply each item to its corresponding indexed frame
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const frame = indexedFrames.get(i);
        
        if (!frame) {
            // No frame for this index - skip
            continue;
        }
        
        const fieldLayers = findFieldLayers(frame);
        
        // Apply each field from the item to the corresponding layer
        for (const [fieldName, value] of Object.entries(item)) {
            const layer = fieldLayers.get(fieldName);
            if (!layer) continue;
            
            try {
                const textNode = layer.type === 'TEXT' ? layer : findTextInNode(layer);
                if (textNode) {
                    const fontName = textNode.fontName as FontName;
                    await figma.loadFontAsync(fontName);
                    textNode.characters = String(value ?? '');
                    updated++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Error applying ${fieldName}:`, error);
                failed++;
            }
        }
    }
    
    return { updated, failed };
}
