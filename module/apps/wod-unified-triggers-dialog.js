import { WodTriggerConfigDialog } from './wod-trigger-config-dialog.js';

/**
 * Unified WoD Triggers Dialog
 * Handles all trigger management contexts (scenes, actors, walls, tiles, regions)
 * while maintaining a single implementation
 */
export class WodUnifiedTriggersDialog extends Dialog {
    
    constructor(document, options = {}) {
        super({
            title: options.title || 'WoD Triggers',
            content: '',
            buttons: {
                close: {
                    label: "Close",
                    callback: () => {}
                }
            },
            default: "close",
            ...options
        });
        
        this.document = document;
        this.context = options.context || {};
        this.onClose = options.onClose;
        this.documentType = options.documentType || 'actor';
        
        // Initialize dialog content
        this._initializeContent();
    }
    
    /**
     * Initialize the dialog content based on context
     */
    async _initializeContent() {
        const triggers = this._getTriggers();
        const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
        
        if (typeof renderFn !== 'function') {
            throw new Error('No renderTemplate function available');
        }
        
        // Get document type info for display
        const registry = game.wodsystem?.triggerRegistry;
        const docTypeInfo = registry?.getDocumentType?.(this.documentType);
        
        const templateData = {
            triggers: Array.isArray(triggers) ? triggers : [],
            documentType: this.documentType,
            docTypeInfo: docTypeInfo,
            documentName: this.document.name || this.document.id,
            documentId: this.document.id,
            isGM: game.user.isGM,
            context: this.context
        };
        
        try {
            const rendered = await renderFn(
                'systems/wodsystem/templates/apps/wod-triggers-tab.html',
                templateData
            );
            
            // Create unified dialog content
            const dialogContent = `
                <style>
                    .wod-triggers-dialog .trigger-list {
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    .wod-triggers-dialog .trigger-item {
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 10px;
                        margin-bottom: 10px;
                        background: #f9f9f9;
                    }
                    .wod-triggers-dialog .trigger-item:hover {
                        background: #f0f0f0;
                    }
                    .wod-triggers-dialog .no-triggers {
                        text-align: center;
                        color: #666;
                        font-style: italic;
                        padding: 20px;
                    }
                    .wod-triggers-dialog .add-trigger-btn {
                        background: linear-gradient(to bottom, #4cae4c, #449d44);
                        color: white;
                        border: 1px solid #3d8b3d;
                        border-radius: 4px;
                        padding: 10px 20px;
                        cursor: pointer;
                        font-weight: bold;
                        margin-top: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                    }
                    .wod-triggers-dialog .add-trigger-btn:hover {
                        background: linear-gradient(to bottom, #5cb85c, #4cae4c);
                        border-color: #398439;
                        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                        transform: scale(1.05);
                    }
                    .wod-triggers-dialog .add-trigger-btn:active {
                        background: linear-gradient(to bottom, #449d44, #3d8b3d);
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                        transform: scale(0.95);
                    }
                </style>
                <div class="wod-triggers-dialog">
                    <h2>WoD Triggers - ${this._getDocumentTitle()}</h2>
                    <div class="trigger-list">
                        ${rendered}
                    </div>
                    <button type="button" class="add-trigger-btn">
                        <i class="fa-solid fa-plus"></i> Add Trigger
                    </button>
                </div>
            `;
            
            // Update dialog content
            this.data.content = dialogContent;
            this.render(false);
            
            // Attach event listeners after content is rendered
            this._attachEventListeners();
            
        } catch (error) {
            console.error('WoD Unified Triggers Dialog | Error rendering content:', error);
            this.data.content = '<div class="error">Error loading triggers content</div>';
            this.render(false);
        }
    }
    
    /**
     * Get triggers based on document type and context
     */
    _getTriggers() {
        switch (this.documentType) {
            case 'scene':
                return this.document.getFlag('wodsystem', 'sceneTriggers') || [];
            case 'actor':
                return this.document.getFlag('wodsystem', 'triggers') || [];
            case 'wall':
                return this.document.getFlag('wodsystem', 'triggers') || [];
            case 'tile':
                return this.document.getFlag('wodsystem', 'triggers') || [];
            case 'region':
                return this.document.getFlag('wodsystem', 'triggers') || [];
            default:
                return [];
        }
    }
    
    /**
     * Save triggers based on document type and context
     */
    _saveTriggers(triggers) {
        const flagPath = this._getFlagPath();
        return this.document.setFlag('wodsystem', flagPath, triggers);
    }
    
    /**
     * Get the flag path based on document type
     */
    _getFlagPath() {
        switch (this.documentType) {
            case 'scene':
                return 'sceneTriggers';
            case 'actor':
            case 'wall':
            case 'tile':
            case 'region':
            default:
                return 'triggers';
        }
    }
    
    /**
     * Get document title for display
     */
    _getDocumentTitle() {
        if (this.document.name) {
            return this.document.name;
        }
        if (this.document.id) {
            return `Document ${this.document.id}`;
        }
        return 'Unknown Document';
    }
    
    /**
     * Attach event listeners to dialog elements
     */
    _attachEventListeners() {
        const dialogElement = $(this.element);
        
        // Add trigger button
        const $addButton = dialogElement.find('.add-trigger-btn');
        
        if ($addButton.length) {
            console.log('WoD Unified Triggers Dialog | Found add trigger button');
            
            $addButton.off('click.unifiedTrigger').on('click.unifiedTrigger', (event) => {
                console.log('WoD Unified Triggers Dialog | Add trigger button clicked');
                event.preventDefault();
                event.stopPropagation();
                
                // Open the trigger config dialog for this document
                this._openTriggerConfigDialog();
            });
        } else {
            console.warn('WoD Unified Triggers Dialog | Could not find add trigger button');
        }
        
        // Trigger action buttons (edit, delete, etc.)
        dialogElement.find('.trigger-action').off('click.unifiedAction').on('click.unifiedAction', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const action = $(event.currentTarget).data('action');
            const triggerId = $(event.currentTarget).data('triggerId');
            
            this._handleTriggerAction(action, triggerId);
        });
    }
    
    /**
     * Open trigger config dialog
     */
    _openTriggerConfigDialog() {
        import('./wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const triggerDialog = new DialogClass(this.document, null, {
                    title: `Add Trigger - ${this._getDocumentTitle()}`,
                    documentType: this.documentType,
                    onClose: () => {
                        // Refresh the dialog content
                        this._initializeContent();
                        if (this.onClose) {
                            this.onClose();
                        }
                    }
                });
                triggerDialog.render(true);
            }
        }).catch(error => {
            console.error('WoD Unified Triggers Dialog | Error loading config dialog:', error);
            ui.notifications.error('Could not open trigger configuration dialog');
        });
    }
    
    /**
     * Handle trigger actions (edit, delete, etc.)
     */
    async _handleTriggerAction(action, triggerId) {
        const triggers = this._getTriggers();
        
        switch (action) {
            case 'edit-trigger':
                if (triggerId) {
                    const trigger = triggers.find(t => t.id === triggerId);
                    if (trigger) {
                        this._openTriggerConfigDialog(trigger);
                    }
                }
                break;
                
            case 'delete-trigger':
                if (triggerId) {
                    const next = triggers.filter(t => t.id !== triggerId);
                    await this._saveTriggers(next);
                    this._initializeContent();
                    ui.notifications.info('Trigger deleted');
                }
                break;
                
            case 'toggle-trigger':
                if (triggerId) {
                    const trigger = triggers.find(t => t.id === triggerId);
                    if (trigger) {
                        trigger.enabled = !trigger.enabled;
                        await this._saveTriggers(triggers);
                        this._initializeContent();
                    }
                }
                break;
                
            default:
                console.warn(`WoD Unified Triggers Dialog | Unknown action: ${action}`);
        }
    }
    
    /**
     * Static method to create unified dialog for any document
     */
    static create(document, options = {}) {
        return new WodUnifiedTriggersDialog(document, options);
    }
}
