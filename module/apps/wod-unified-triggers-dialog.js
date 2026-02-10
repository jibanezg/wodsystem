import { WodTriggerConfigDialog } from './wod-trigger-config-dialog.js';

/**
 * Unified WoD Triggers Dialog
 * Handles all trigger management contexts (scenes, actors, walls, tiles, regions)
 * while maintaining a single implementation
 * Updated: 2025-02-10 - RESTORED ORIGINAL SCENE DIALOG STRUCTURE
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
     * Initialize the dialog content
     */
    async _initializeContent() {
        // Wait a bit for the DOM to be ready, then attach event listeners
        setTimeout(() => {
            this._attachWorkingEventListeners();
        }, 100);
    }
    
    /**
     * Attach event listeners using the same pattern as the working scene dialog
     */
    _attachWorkingEventListeners() {
        const dialogElement = $(this.element);
        
        // Foundry uses .window-content, not .dialog-content
        const contentElement = dialogElement.find('.window-content');
        
        // Add click listener for add trigger button using the same system as actors/doors
        // Target the beautiful circular green button
        const $button = contentElement.find('.wod-add-trigger-btn');
        
        if ($button.length) {
            $button.off('click.unifiedTrigger').on('click.unifiedTrigger', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // Open the trigger config dialog for this document
                this._openTriggerConfigDialog();
            });
        }

        // Add click listeners for trigger edit and delete buttons
        contentElement.find('.trigger-edit, .trigger-delete').off('click.unifiedAction').on('click.unifiedAction', (event) => {
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
