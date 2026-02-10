import { WodTriggerConfigDialog } from './wod-trigger-config-dialog.js';

/**
 * Unified WoD Triggers Dialog
 * Handles all trigger management contexts (scenes, actors, walls, tiles, regions)
 * while maintaining a single implementation
 * Updated: 2025-02-10 - Removed ugly button
 */
export class WodUnifiedTriggersDialog extends Dialog {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: 'WoD Triggers',
            template: 'systems/wodsystem/templates/apps/wod-unified-triggers-dialog.html',
            width: 600,
            height: 500,
            resizable: true,
            classes: ['wod-unified-triggers-dialog']
        });
    }
    
    constructor(document, options = {}) {
        super({
            title: options.title || 'WoD Triggers',
            content: '<div class="dialog-content">Loading...</div>',
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
        
        console.log('WoD Unified Triggers Dialog | Constructor called for:', this.documentType, document.name || document.id);
    }
    
    /**
     * Initialize the dialog content when the dialog is rendered
     */
    render(force = false) {
        super.render(force);
        this._initializeContent();
    }
    
    /**
     * Get data for template rendering
     */
    async getData() {
        const triggers = this._getTriggers();
        const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
        
        if (typeof renderFn !== 'function') {
            throw new Error('No renderTemplate function available');
        }
        
        // Get document type info for display
        const registry = game.wodsystem?.triggerRegistry;
        const docTypeInfo = registry?.getDocumentType?.(this.documentType);
        
        // Render the triggers list
        const rendered = await renderFn(
            'systems/wodsystem/templates/apps/wod-triggers-tab.html',
            {
                triggers: Array.isArray(triggers) ? triggers : [],
                documentType: this.documentType,
                docTypeInfo: docTypeInfo,
                documentName: this.document.name || this.document.id,
                documentId: this.document.id,
                isGM: game.user.isGM,
                context: this.context
            }
        );
        
        return {
            triggers: Array.isArray(triggers) ? triggers : [],
            documentType: this.documentType,
            docTypeInfo: docTypeInfo,
            documentName: this.document.name || this.document.id,
            documentId: this.document.id,
            isGM: game.user.isGM,
            context: this.context,
            renderedContent: rendered,
            documentTitle: this._getDocumentTitle()
        };
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
     * Initialize the dialog content using the EXACT same structure as the original working scene dialog
     */
    async _initializeContent() {
        try {
            const data = await this.getData();
            const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
            
            // Render the triggers list using the same template as the original dialogs
            const rendered = await renderFn(
                'systems/wodsystem/templates/apps/wod-triggers-tab.html',
                {
                    triggers: Array.isArray(data.triggers) ? data.triggers : [],
                    documentType: this.documentType,
                    docTypeInfo: data.docTypeInfo,
                    documentName: data.documentName,
                    documentId: data.documentId,
                    isGM: game.user.isGM,
                    context: this.context
                }
            );
            
            // Create the EXACT same styled dialog content as the original working scene dialog
            const dialogContent = `
                <style>
                    .wod-triggers-container {
                        padding: 0;
                    }
                    .wod-triggers-container .wod-add-trigger-container {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .wod-triggers-container .wod-add-trigger-btn {
                        background: linear-gradient(to bottom, #4cae4c, #449d44);
                        color: white;
                        border: 1px solid #3d8b3d;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        text-shadow: 0 1px 0 rgba(0,0,0,0.2);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s ease;
                        position: relative;
                    }
                    .wod-triggers-container .wod-add-trigger-btn:hover {
                        background: linear-gradient(to bottom, #5cb85c, #4cae4c);
                        border-color: #398439;
                        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                        transform: scale(1.1);
                    }
                    .wod-triggers-container .wod-add-trigger-btn:active {
                        background: linear-gradient(to bottom, #449d44, #3d8b3d);
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                        transform: scale(0.95);
                    }
                    .wod-triggers-container .wod-add-trigger-btn i {
                        margin: 0;
                    }
                    .wod-triggers-content {
                        padding: 0 15px 15px;
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    .wod-triggers-list {
                        min-height: 200px;
                    }
                    .wod-triggers-list .notes {
                        text-align: center;
                    }
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
                </style>
                <div class="wod-triggers-container">
                    <div class="wod-triggers-content">
                        <div class="wod-triggers-list">
                            <div class="wod-triggers-dialog">
                                <h2>🔥 UNIFIED DIALOG - WoD Triggers - ${data.documentTitle}</h2>
                                <div class="trigger-list">
                                    ${rendered}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="wod-add-trigger-container">
                        <button type="button" class="wod-add-trigger-btn" title="Add Trigger">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Update dialog content
            const dialogElement = $(this.element);
            if (dialogElement.length) {
                dialogElement.find('.dialog-content').html(dialogContent);
                
                // Attach event listeners using the same pattern as the working scene dialog
                this._attachWorkingEventListeners();
            }
        } catch (error) {
            console.error('WoD Unified Triggers Dialog | Error initializing content:', error);
            ui.notifications.error('Could not load trigger content');
        }
    }
    
    /**
     * Attach event listeners using the same pattern as the working scene dialog
     */
    _attachWorkingEventListeners() {
        const dialogElement = $(this.element);
        
        // Add click listener for add trigger button using the same system as actors/doors
        // Only target the nice circular green button
        const $button = dialogElement.find('.wod-add-trigger-btn');
        
        if ($button.length) {
            console.log('WoD Unified Triggers Dialog | Found add trigger button');
            
            $button.off('click.unifiedTrigger').on('click.unifiedTrigger', (event) => {
                console.log('WoD Unified Triggers Dialog | Add trigger button clicked');
                event.preventDefault();
                event.stopPropagation();

                // Open the trigger config dialog for this document
                this._openTriggerConfigDialog();
            });
        } else {
            console.warn('WoD Unified Triggers Dialog | Could not find add trigger button');
        }

        // Add click listeners for trigger actions
        dialogElement.find('.trigger-action').off('click.unifiedAction').on('click.unifiedAction', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const action = $(event.currentTarget).data('action');
            const triggerId = $(event.currentTarget).data('triggerId');
            
            this._handleTriggerAction(action, triggerId);
        });
    }
    
    /**
     * Open trigger config dialog using the exact same pattern as the working scene dialog
     */
    _openTriggerConfigDialog(triggerId = null) {
        import('./wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const triggerDialog = new DialogClass(this.document, triggerId, {
                    title: triggerId ? `Edit Trigger - ${this._getDocumentTitle()}` : `Add Trigger - ${this._getDocumentTitle()}`,
                    documentType: this.documentType,
                    onClose: () => {
                        // Refresh the dialog content using the same pattern as scene dialog
                        this._refreshDialogContent();
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
     * Refresh dialog content using the same pattern as the working scene dialog
     */
    async _refreshDialogContent() {
        try {
            const data = await this.getData();
            const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
            
            // Render the triggers list
            const rendered = await renderFn(
                'systems/wodsystem/templates/apps/wod-triggers-tab.html',
                {
                    triggers: Array.isArray(data.triggers) ? data.triggers : [],
                    documentType: this.documentType,
                    docTypeInfo: data.docTypeInfo,
                    documentName: data.documentName,
                    documentId: data.documentId,
                    isGM: game.user.isGM,
                    context: this.context
                }
            );
            
            // Update the trigger list content
            const dialogElement = $(this.element);
            if (dialogElement.length) {
                dialogElement.find('.trigger-list').html(rendered);
                
                // Re-attach event listeners for the new content
                this._attachWorkingEventListeners();
            }
            
            // Call the onClose callback if it exists
            if (this.onClose) {
                this.onClose();
            }
        } catch (error) {
            console.error('WoD Unified Triggers Dialog | Error refreshing content:', error);
        }
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
                        this._openTriggerConfigDialog(triggerId);
                    }
                }
                break;
                
            case 'delete-trigger':
                if (triggerId) {
                    const next = triggers.filter(t => t.id !== triggerId);
                    await this._saveTriggers(next);
                    this._refreshDialogContent();
                    ui.notifications.info('Trigger deleted');
                }
                break;
                
            case 'toggle-trigger':
                if (triggerId) {
                    const trigger = triggers.find(t => t.id === triggerId);
                    if (trigger) {
                        trigger.enabled = !trigger.enabled;
                        await this._saveTriggers(triggers);
                        this._refreshDialogContent();
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
        const dialog = new WodUnifiedTriggersDialog(document, options);
        dialog.render(true);
        return dialog;
    }
}
