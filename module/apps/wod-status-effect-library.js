import { i18n } from '../helpers/i18n.js';
import { WodEffectEditor } from './wod-effect-manager.js';

/**
 * Status Effect Library Dialog
 * Allows GMs to create, edit, and manage global status effect templates
 */
export class WodStatusEffectLibrary extends FormApplication {
    constructor(manager, options = {}) {
        super({}, options);
        this.manager = manager;
        this.selectedEffectId = null;
        this.filterCategory = '';
        this.filterTag = '';
        this.searchQuery = '';
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'wod-status-effect-library',
            classes: ['wod', 'dialog', 'status-effect-library'],
            template: 'systems/wodsystem/templates/apps/status-effect-library.html',
            width: 700,
            height: 600,
            resizable: true,
            title: game.i18n?.localize('WODSYSTEM.StatusEffects.EffectLibrary') || 'Status Effect Library',
            closeOnSubmit: false,
            submitOnChange: false
        });
    }

    async getData() {
        const data = super.getData();
        
        // Get all effect templates
        let effects = this.manager.getAllEffectTemplates();
        
        // Apply filters
        if (this.filterCategory) {
            effects = effects.filter(e => e.category === this.filterCategory);
        }
        if (this.filterTag) {
            effects = effects.filter(e => e.tags && e.tags.includes(this.filterTag));
        }
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            effects = effects.filter(e => 
                e.name.toLowerCase().includes(query) ||
                (e.description && e.description.toLowerCase().includes(query))
            );
        }
        
        // Sort by name
        effects.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add document type flags for template rendering
        effects = effects.map(e => {
            const dt = e.documentTypes || [];
            const isUniversal = !dt || dt.length === 0;
            return {
                ...e,
                docTypeActor: dt.includes('actor'),
                docTypeWall: dt.includes('wall'),
                docTypeTile: dt.includes('tile'),
                docTypeRegion: dt.includes('region'),
                docTypeScene: dt.includes('scene'),
                isUniversal
            };
        });
        
        data.effects = effects;
        data.categories = this.manager.getAllCategories();
        data.tags = this.manager.getAllTags();
        data.selectedEffectId = this.selectedEffectId;
        data.filterCategory = this.filterCategory;
        data.filterTag = this.filterTag;
        data.searchQuery = this.searchQuery;
        data.isGM = game.user.isGM;
        
        // Get selected effect details
        if (this.selectedEffectId) {
            const sel = this.manager.getEffectTemplate(this.selectedEffectId);
            if (sel) {
                const dt = sel.documentTypes || [];
                const isUniversal = !dt || dt.length === 0;
                data.selectedEffect = {
                    ...sel,
                    docTypeActor: dt.includes('actor'),
                    docTypeWall: dt.includes('wall'),
                    docTypeTile: dt.includes('tile'),
                    docTypeRegion: dt.includes('region'),
                    docTypeScene: dt.includes('scene'),
                    isUniversal
                };
            }
        }
        
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Effect list interactions
        html.find('.effect-item').on('click', this._onSelectEffect.bind(this));
        html.find('.effect-item').on('dblclick', this._onEditEffect.bind(this));
        
        // Toolbar buttons
        html.find('.create-effect-btn').on('click', this._onCreateEffect.bind(this));
        html.find('.edit-effect-btn').on('click', this._onEditSelectedEffect.bind(this));
        html.find('.delete-effect-btn').on('click', this._onDeleteEffect.bind(this));
        html.find('.apply-effect-btn').on('click', this._onApplyEffect.bind(this));
        
        // Filters
        html.find('.filter-category').on('change', this._onFilterCategory.bind(this));
        html.find('.filter-tag').on('change', this._onFilterTag.bind(this));
        html.find('.search-input').on('input', this._onSearch.bind(this));
        html.find('.clear-filters-btn').on('click', this._onClearFilters.bind(this));
        
        // Category/Tag management
        html.find('.manage-categories-btn').on('click', this._onManageCategories.bind(this));
        html.find('.manage-tags-btn').on('click', this._onManageTags.bind(this));
    }

    _onSelectEffect(event) {
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        const effect = this.manager.getEffectTemplate(effectId);
        
                
        // Show tooltip for ALL effects
        if (effect) {
            this._showEffectTooltip(event, effect);
        }
    }

    async _onCreateEffect(event) {
        event.preventDefault();
        
        // Open effect editor dialog for new effect using WodEffectManager
        const effectData = await this._openEffectEditorWithFullManager(null);
        if (effectData) {
            await this.manager.createEffectTemplate(effectData);
            ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectCreated', { name: effectData.name }));
            this.render(false);
        }
    }

    _onEditEffect(event) {
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        this._editEffect(effectId);
    }

    _onEditSelectedEffect(event) {
        event.preventDefault();
        if (this.selectedEffectId) {
            this._editEffect(this.selectedEffectId);
        }
    }

    async _editEffect(effectId) {
        const effect = this.manager.getEffectTemplate(effectId);
        if (!effect) return;
        
        const effectData = await this._openEffectEditorWithFullManager(effect);
        if (effectData) {
            await this.manager.updateEffectTemplate(effectId, effectData);
            ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectUpdated', { name: effectData.name }));
            this.render(false);
        }
    }

    async _onDeleteEffect(event) {
        event.preventDefault();
        
        const effectId = event.currentTarget.dataset.effectId;
        if (!effectId) return;
        
        const effect = this.manager.getEffectTemplate(effectId);
        if (!effect) return;
        
        const confirmed = await Dialog.confirm({
            title: i18n('WODSYSTEM.StatusEffects.DeleteEffect'),
            content: `<p>${i18n('WODSYSTEM.StatusEffects.ConfirmDelete', { name: effect.name })}</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (confirmed) {
            await this.manager.deleteEffectTemplate(effectId);
            this.selectedEffectId = null;
            ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectDeleted', { name: effect.name }));
            this.render(false);
        }
    }

    async _onApplyEffect(event) {
        event.preventDefault();
        if (!this.selectedEffectId) return;
        
        // Open the assignment dialog with this effect pre-selected
        import('./wod-effect-assignment.js').then(module => {
            const dialog = new module.WodEffectAssignment(this.manager, [this.selectedEffectId]);
            dialog.render(true);
        });
    }

    _onFilterCategory(event) {
        this.filterCategory = event.currentTarget.value;
        this.render(false);
    }

    _onFilterTag(event) {
        this.filterTag = event.currentTarget.value;
        this.render(false);
    }

    _onSearch(event) {
        this.searchQuery = event.currentTarget.value;
        this.render(false);
    }

    _onClearFilters(event) {
        event.preventDefault();
        this.filterCategory = '';
        this.filterTag = '';
        this.searchQuery = '';
        this.render(false);
    }

    async _onManageCategories(event) {
        event.preventDefault();
        
        const categories = this.manager.getAllCategories();
        
        const content = `
            <form>
                <div class="form-group">
                    <label>${i18n('WODSYSTEM.StatusEffects.CurrentCategories')}</label>
                    <div class="category-list">
                        ${categories.length > 0 
                            ? categories.map(c => `<span class="tag-chip">${c} <button type="button" class="remove-category" data-category="${c}">×</button></span>`).join('')
                            : `<em>${i18n('WODSYSTEM.StatusEffects.NoCategories')}</em>`
                        }
                    </div>
                </div>
                <div class="form-group">
                    <label>${i18n('WODSYSTEM.StatusEffects.AddCategory')}</label>
                    <input type="text" name="newCategory" placeholder="${i18n('WODSYSTEM.StatusEffects.CategoryName')}" />
                </div>
            </form>
        `;
        
        new Dialog({
            title: i18n('WODSYSTEM.StatusEffects.ManageCategories'),
            content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: i18n('WODSYSTEM.Common.Add'),
                    callback: async (html) => {
                        const newCategory = html.find('input[name="newCategory"]').val().trim();
                        if (newCategory) {
                            await this.manager.addCategory(newCategory);
                            this.render(false);
                        }
                    }
                },
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: i18n('WODSYSTEM.Common.Close')
                }
            },
            render: (html) => {
                html.find('.remove-category').on('click', async (ev) => {
                    const category = ev.currentTarget.dataset.category;
                    await this.manager.removeCategory(category);
                    this._onManageCategories(event);
                });
            }
        }).render(true);
    }

    async _onManageTags(event) {
        event.preventDefault();
        
        const tags = this.manager.getAllTags();
        
        const content = `
            <form>
                <div class="form-group">
                    <label>${i18n('WODSYSTEM.StatusEffects.CurrentTags')}</label>
                    <div class="tag-list">
                        ${tags.length > 0 
                            ? tags.map(t => `<span class="tag-chip">${t} <button type="button" class="remove-tag" data-tag="${t}">×</button></span>`).join('')
                            : `<em>${i18n('WODSYSTEM.StatusEffects.NoTags')}</em>`
                        }
                    </div>
                </div>
                <div class="form-group">
                    <label>${i18n('WODSYSTEM.StatusEffects.AddTag')}</label>
                    <input type="text" name="newTag" placeholder="${i18n('WODSYSTEM.StatusEffects.TagName')}" />
                </div>
            </form>
        `;
        
        new Dialog({
            title: i18n('WODSYSTEM.StatusEffects.ManageTags'),
            content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: i18n('WODSYSTEM.Common.Add'),
                    callback: async (html) => {
                        const newTag = html.find('input[name="newTag"]').val().trim();
                        if (newTag) {
                            await this.manager.addTag(newTag);
                            this.render(false);
                        }
                    }
                },
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: i18n('WODSYSTEM.Common.Close')
                }
            },
            render: (html) => {
                html.find('.remove-tag').on('click', async (ev) => {
                    const tag = ev.currentTarget.dataset.tag;
                    await this.manager.removeTag(tag);
                    this._onManageTags(event);
                });
            }
        }).render(true);
    }

    /**
     * Open the effect editor dialog
     * @param {Object|null} effect - Existing effect to edit, or null for new
     * @returns {Promise<Object|null>} The effect data or null if cancelled
     */
    async _openEffectEditor(effect) {
        const categories = this.manager.getAllCategories();
        const tags = this.manager.getAllTags();
        
        const isNew = !effect;
        const effectData = effect || {
            name: '',
            icon: 'icons/svg/aura.svg',
            description: '',
            category: '',
            tags: [],
            mandatory: true,
            conditionScope: 'always',
            conditionTargets: [],
            changes: []
        };
        
        return new Promise((resolve) => {
            const content = `
                <form class="effect-editor-form">
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.EffectName')}</label>
                        <input type="text" name="name" value="${effectData.name}" required />
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.Icon')}</label>
                        <div class="icon-picker">
                            <input type="text" name="icon" value="${effectData.icon}" />
                            <button type="button" class="file-picker" data-type="image" data-target="icon">
                                <i class="fas fa-file-image"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.Description')}</label>
                        <textarea name="description" rows="3">${effectData.description || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.Category')}</label>
                        <select name="category">
                            <option value="">${i18n('WODSYSTEM.StatusEffects.NoCategory')}</option>
                            ${categories.map(c => `<option value="${c}" ${effectData.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.Tags')}</label>
                        <div class="tags-checkboxes">
                            ${tags.map(t => `
                                <label class="tag-checkbox">
                                    <input type="checkbox" name="tags" value="${t}" ${effectData.tags?.includes(t) ? 'checked' : ''} />
                                    <span>${t}</span>
                                </label>
                            `).join('')}
                            ${tags.length === 0 ? `<em>${i18n('WODSYSTEM.StatusEffects.NoTagsAvailable')}</em>` : ''}
                        </div>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" name="mandatory" ${effectData.mandatory ? 'checked' : ''} />
                            ${i18n('WODSYSTEM.StatusEffects.Mandatory')}
                        </label>
                        <small>${i18n('WODSYSTEM.StatusEffects.MandatoryHint')}</small>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.ConditionScope')}</label>
                        <select name="conditionScope">
                            <option value="always" ${effectData.conditionScope === 'always' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.AlwaysActive')}</option>
                            <option value="attribute" ${effectData.conditionScope === 'attribute' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.SpecificAttribute')}</option>
                            <option value="ability" ${effectData.conditionScope === 'ability' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.SpecificAbility')}</option>
                            <option value="advantage" ${effectData.conditionScope === 'advantage' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.SpecificAdvantage')}</option>
                            <option value="exclude" ${effectData.conditionScope === 'exclude' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.ExcludeSpecificTraits')}</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n('WODSYSTEM.StatusEffects.Modifiers')}</label>
                        <div class="modifiers-list">
                            ${(effectData.changes || []).map((change, idx) => `
                                <div class="modifier-row" data-index="${idx}">
                                    <select name="changes.${idx}.key">
                                        <option value="pool" ${change.key === 'pool' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.PoolDice')}</option>
                                        <option value="difficulty" ${change.key === 'difficulty' ? 'selected' : ''}>${i18n('WODSYSTEM.RollDialog.Difficulty')}</option>
                                        <option value="autoSuccess" ${change.key === 'autoSuccess' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.AutoSuccess')}</option>
                                        <option value="autoFail" ${change.key === 'autoFail' ? 'selected' : ''}>${i18n('WODSYSTEM.EffectManager.AutoFail')}</option>
                                    </select>
                                    <input type="number" name="changes.${idx}.value" value="${change.value || 0}" />
                                    <button type="button" class="remove-modifier"><i class="fas fa-times"></i></button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="add-modifier-btn"><i class="fas fa-plus"></i> ${i18n('WODSYSTEM.StatusEffects.AddModifier')}</button>
                    </div>
                </form>
            `;
            
            const dialog = new Dialog({
                title: isNew ? i18n('WODSYSTEM.StatusEffects.CreateEffect') : i18n('WODSYSTEM.StatusEffects.EditEffect'),
                content,
                buttons: {
                    save: {
                        icon: '<i class="fas fa-save"></i>',
                        label: i18n('WODSYSTEM.Common.Save'),
                        callback: (html) => {
                            const form = html.find('form')[0];
                            const formData = new FormDataExtended(form).object;
                            
                            // Parse tags from checkboxes
                            const selectedTags = [];
                            html.find('input[name="tags"]:checked').each((i, el) => {
                                selectedTags.push(el.value);
                            });
                            
                            // Parse changes
                            const changes = [];
                            html.find('.modifier-row').each((i, row) => {
                                const key = $(row).find('select').val();
                                const value = parseInt($(row).find('input[type="number"]').val()) || 0;
                                if (key) {
                                    changes.push({ key, value, mode: 2 });
                                }
                            });
                            
                            resolve({
                                name: formData.name || 'New Effect',
                                icon: formData.icon || 'icons/svg/aura.svg',
                                description: formData.description || '',
                                category: formData.category || '',
                                tags: selectedTags,
                                mandatory: formData.mandatory === true || formData.mandatory === 'true',
                                conditionScope: formData.conditionScope || 'always',
                                conditionTargets: [],
                                changes
                            });
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: i18n('WODSYSTEM.Common.Cancel'),
                        callback: () => resolve(null)
                    }
                },
                default: 'save',
                render: (html) => {
                    // File picker for icon
                    html.find('.file-picker').on('click', (ev) => {
                        const target = ev.currentTarget.dataset.target;
                        const input = html.find(`input[name="${target}"]`);
                        new FilePicker({
                            type: 'image',
                            current: input.val(),
                            callback: (path) => input.val(path)
                        }).render(true);
                    });
                    
                    // Add modifier
                    html.find('.add-modifier-btn').on('click', () => {
                        const list = html.find('.modifiers-list');
                        const idx = list.find('.modifier-row').length;
                        const row = $(`
                            <div class="modifier-row" data-index="${idx}">
                                <select name="changes.${idx}.key">
                                    <option value="pool">${i18n('WODSYSTEM.EffectManager.PoolDice')}</option>
                                    <option value="difficulty">${i18n('WODSYSTEM.RollDialog.Difficulty')}</option>
                                    <option value="autoSuccess">${i18n('WODSYSTEM.EffectManager.AutoSuccess')}</option>
                                    <option value="autoFail">${i18n('WODSYSTEM.EffectManager.AutoFail')}</option>
                                </select>
                                <input type="number" name="changes.${idx}.value" value="0" />
                                <button type="button" class="remove-modifier"><i class="fas fa-times"></i></button>
                            </div>
                        `);
                        list.append(row);
                        row.find('.remove-modifier').on('click', () => row.remove());
                    });
                    
                    // Remove modifier
                    html.find('.remove-modifier').on('click', (ev) => {
                        $(ev.currentTarget).closest('.modifier-row').remove();
                    });
                },
                close: () => resolve(null)
            }, { width: 500 });
            
            dialog.render(true);
        });
    }

    async _updateObject(event, formData) {
        // Form submission handled by buttons
    }

    _showEffectTooltip(event, effect) {
        // Remove any existing tooltip first
        const existingTooltip = document.querySelector('.wod-effect-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
            return; // If clicking again on same effect, just close the tooltip
        }
        
        const isCore = effect.isCore === true || effect.category === 'Core';
        
        const tooltip = `
            <div class="wod-effect-tooltip">
                <h4>${effect.name}</h4>
                ${effect.description ? `<p>${effect.description}</p>` : ''}
                ${effect.changes && effect.changes.length > 0 ? `
                    <div class="effect-changes">
                        <strong>Effects:</strong>
                        <ul>
                            ${effect.changes.map(change => `
                                <li>${change.key}: ${change.value > 0 ? '+' : ''}${change.value}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${effect.tokenEffects ? `
                    <div class="effect-token-effects">
                        <strong>Token Effects:</strong>
                        <ul>
                            ${effect.tokenEffects.light ? `<li><i class="fas fa-sun"></i> Light: Dim ${effect.tokenEffects.light.dim}, Bright ${effect.tokenEffects.light.bright}</li>` : ''}
                            ${effect.tokenEffects.vision ? `<li><i class="fas fa-eye"></i> Vision: ${effect.tokenEffects.vision.visionMode || 'basic'} (range ${Math.max(effect.tokenEffects.vision.dimSight || 0, effect.tokenEffects.vision.brightSight || 0)})</li>` : ''}
                        </ul>
                    </div>
                ` : ''}
                ${effect.tags && effect.tags.length > 0 ? `
                    <div class="effect-tags">
                        <strong>Tags:</strong> ${effect.tags.join(', ')}
                    </div>
                ` : ''}
                ${!isCore ? `
                    <div class="effect-actions">
                        <button type="button" class="tooltip-edit-btn" data-effect-id="${effect.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button type="button" class="tooltip-delete-btn" data-effect-id="${effect.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                ` : ''}
                <div class="effect-note">
                    <em>${isCore ? 'Core effect - automatically applied based on character conditions' : 'User-created effect'}</em>
                </div>
            </div>
        `;

        // Create and show tooltip
        const tooltipElement = document.createElement('div');
        tooltipElement.innerHTML = tooltip;
        tooltipElement.className = 'wod-effect-tooltip';
        tooltipElement.style.position = 'absolute';
        tooltipElement.style.background = '#ffffff';
        tooltipElement.style.border = '1px solid #e5e7eb';
        tooltipElement.style.borderRadius = '4px';
        tooltipElement.style.padding = '8px';
        tooltipElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        tooltipElement.style.zIndex = '1000';
        tooltipElement.style.maxWidth = '300px';

        // Position tooltip above or below the clicked element
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltipHeight = 150; // Estimated height
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        if (spaceBelow >= tooltipHeight) {
            // Position below
            tooltipElement.style.left = `${rect.left}px`;
            tooltipElement.style.top = `${rect.bottom + 5}px`;
        } else {
            // Position above
            tooltipElement.style.left = `${rect.left}px`;
            tooltipElement.style.top = `${rect.top - tooltipHeight - 5}px`;
        }

        document.body.appendChild(tooltipElement);

        // Add event listeners for edit/delete buttons
        if (!isCore) {
            const editBtn = tooltipElement.querySelector('.tooltip-edit-btn');
            const deleteBtn = tooltipElement.querySelector('.tooltip-delete-btn');
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._onEditEffect(e);
                    tooltipElement.remove();
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._onDeleteEffect(e);
                    tooltipElement.remove();
                });
            }
        }

        // Add click listener to remove tooltip when clicking outside
        const removeTooltip = (e) => {
            if (!tooltipElement.contains(e.target)) {
                const tooltip = document.querySelector('.wod-effect-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
                document.removeEventListener('click', removeTooltip);
            }
        };

        // Add click listener after a small delay to avoid immediate removal
        setTimeout(() => {
            document.addEventListener('click', removeTooltip);
        }, 50);
    }

    /**
     * Open effect editor using the unified WodEffectEditor
     * @param {Object|null} effect - Existing effect data or null for new effect
     * @returns {Promise<Object|null>} Effect data or null if cancelled
     */
    async _openEffectEditorWithFullManager(effect) {
        return new Promise((resolve) => {
            const editor = new WodEffectEditor(null, null, {
                mode: 'template',
                effectData: effect,
                title: effect ? i18n('WODSYSTEM.StatusEffects.EditEffect') : i18n('WODSYSTEM.StatusEffects.CreateEffect'),
                onSave: async (templateData) => {
                    resolve(templateData);
                }
            });
            
            // Override close to handle cancellation
            editor.close = () => {
                resolve(null);
                FormApplication.prototype.close.call(editor);
            };
            
            editor.render(true);
        });
    }
}
