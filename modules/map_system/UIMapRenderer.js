/**
 * The World - UI Map Renderer
 * @description Responsible for rendering the map data into HTML DOM elements.
 */

export class UIMapRenderer {
    constructor(dependencies) {
        Object.assign(this, dependencies);
    }

    render(nodeId, targetElement) {
        this.logger.log(`[UIMapRenderer] Rendering map view for node "${nodeId}"...`);
        targetElement.empty();

        const nodeData = this.mapDataManager.nodes.get(nodeId);
        if (!nodeData) {
            targetElement.html('<p class="tw-notice">Map data not found for this node.</p>');
            return;
        }

        const $mapContainer = this.$('<div class="tw-map-container"></div>');
        const $mapCanvas = this.$('<div class="tw-map-canvas"></div>');
        
        if (nodeData.mapImage) {
            const imageUrl = nodeData.mapImage.startsWith('http') 
                ? nodeData.mapImage 
                : this.dependencies.config.IMAGE_BASE_URL 
                    ? `${this.dependencies.config.IMAGE_BASE_URL}${nodeData.mapImage}` 
                    : nodeData.mapImage;
            $mapCanvas.css('background-image', `url(${imageUrl})`);
        }

        const childNodes = Array.from(this.mapDataManager.nodes.values())
            .filter(loc => loc.parentId === nodeId);

        for (const childNode of childNodes) {
            if (!childNode.coords) continue;

            const $pin = this.$('<div class="tw-map-pin"></div>');
            $pin.attr('data-loc-id', childNode.id);
            $pin.addClass(`type-${childNode.type || 'landmark'}`);
            
            const [x, y] = childNode.coords.split(',').map(Number);
            $pin.css({ left: `${x / 10}%`, top: `${y / 10}%` }); // Assuming coords are 0-1000

            const $pinLabel = this.$(`<div class="tw-map-pin-label">${childNode.name}</div>`);
            $pin.append($pinLabel);
            $mapCanvas.append($pin);
        }

        $mapContainer.append($mapCanvas);
        targetElement.append($mapContainer);
    }
}