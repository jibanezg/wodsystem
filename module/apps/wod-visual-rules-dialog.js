import { WodTokenManager } from '../services/wod-token-manager.js';

/**
 * Token Management dialog for configuring token behaviors on actors or token documents.
 * Currently includes Visual Rules (condition → property mappings).
 * Future: combat maneuvers, item integration, movement control.
 */
export class WodVisualRulesDialog extends FormApplication {

    constructor(document, options = {}) {
        super(document, options);
        this.document = document;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'wod-token-management-dialog',
            title: 'Token Management',
            template: 'systems/wodsystem/templates/apps/wod-visual-rules-dialog.html',
            classes: ['wod-token-management-dialog'],
            width: 560,
            height: 'auto',
            resizable: true,
            closeOnSubmit: false
        });
    }

    get title() {
        return `Token Management — ${this.document.name || 'Unknown'}`;
    }

    getData() {
        const rules = this.document.getFlag('wodsystem', 'visualRules') || [];
        return {
            rules,
            conditionTypes: this._getConditionTypes(),
            propertyTypes: this._getPropertyTypes(),
            operatorTypes: this._getOperatorTypes(),
            isActor: this.document.documentName === 'Actor'
        };
    }

    _getConditionTypes() {
        return [
            { value: 'isIlluminated', label: 'Is Illuminated' },
            { value: 'hasEffect', label: 'Has Active Effect' },
            { value: 'attributeThreshold', label: 'Attribute Threshold' }
        ];
    }

    _getPropertyTypes() {
        return [
            { value: 'opacity', label: 'Opacity' },
            { value: 'tint', label: 'Tint Color' },
            { value: 'scale', label: 'Scale' }
        ];
    }

    _getOperatorTypes() {
        return [
            { value: '<', label: '< Less than' },
            { value: '<=', label: '<= Less or equal' },
            { value: '>', label: '> Greater than' },
            { value: '>=', label: '>= Greater or equal' },
            { value: '==', label: '== Equals' },
            { value: '!=', label: '!= Not equals' }
        ];
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Add rule
        html.find('.add-rule-btn').on('click', () => this._onAddRule());

        // Delete rule
        html.on('click', '.delete-rule-btn', (ev) => {
            const ruleId = $(ev.currentTarget).closest('.visual-rule-row').data('rule-id');
            this._onDeleteRule(ruleId);
        });

        // Toggle enabled
        html.on('change', '.rule-enabled-toggle', (ev) => {
            const ruleId = $(ev.currentTarget).closest('.visual-rule-row').data('rule-id');
            const enabled = $(ev.currentTarget).is(':checked');
            this._onToggleRule(ruleId, enabled);
        });

        // Condition type change — show/hide params
        html.on('change', '.condition-type-select', (ev) => {
            const row = $(ev.currentTarget).closest('.visual-rule-row');
            const condType = $(ev.currentTarget).val();
            row.find('.condition-params').hide();
            row.find(`.condition-params-${condType}`).show();
        });

        // Property type change — update value placeholders
        html.on('change', '.property-type-select', (ev) => {
            const row = $(ev.currentTarget).closest('.visual-rule-row');
            const propType = $(ev.currentTarget).val();
            const activeInput = row.find('.active-value-input');
            const inactiveInput = row.find('.inactive-value-input');
            if (propType === 'opacity') {
                activeInput.attr({ type: 'number', min: 0, max: 1, step: 0.1, placeholder: '1.0' });
                inactiveInput.attr({ type: 'number', min: 0, max: 1, step: 0.1, placeholder: '0.0' });
            } else if (propType === 'tint') {
                activeInput.attr({ type: 'color', placeholder: '' });
                inactiveInput.attr({ type: 'color', placeholder: '' });
            } else if (propType === 'scale') {
                activeInput.attr({ type: 'number', min: 0.1, max: 5, step: 0.1, placeholder: '1.0' });
                inactiveInput.attr({ type: 'number', min: 0.1, max: 5, step: 0.1, placeholder: '1.0' });
            }
        });

        // Sync fade speed range slider ↔ number input
        html.on('input', '.transition-duration-range', (ev) => {
            const row = $(ev.currentTarget).closest('.visual-rule-row');
            row.find('.transition-duration').val(ev.currentTarget.value);
        });
        html.on('change', '.transition-duration', (ev) => {
            const row = $(ev.currentTarget).closest('.visual-rule-row');
            row.find('.transition-duration-range').val(ev.currentTarget.value);
        });

        // Save all
        html.find('.save-rules-btn').on('click', () => this._onSaveAll(html));

        // Diagnose button
        html.find('.diagnose-btn').on('click', () => {
            const manager = WodTokenManager.getInstance();
            manager.diagnose();
            ui.notifications?.info('Diagnostics dumped to browser console (F12)');
        });

        // Re-evaluate button
        html.find('.evaluate-btn').on('click', () => {
            const manager = WodTokenManager.getInstance();
            manager.evaluateAll();
            ui.notifications?.info('Re-evaluation triggered — check console for results');
        });
    }

    async _onAddRule() {
        const manager = WodTokenManager.getInstance();
        await manager.addVisualRule(this.document, {
            condition: { type: 'isIlluminated', params: {} },
            property: 'opacity',
            activeValue: 1.0,
            inactiveValue: 0.0,
            transition: { duration: 500, easing: 'linear' }
        });
        this.render(true);
    }

    async _onDeleteRule(ruleId) {
        const confirmed = await Dialog.confirm({
            title: 'Delete Rule',
            content: '<p>Are you sure you want to delete this token rule?</p>'
        });
        if (!confirmed) return;

        const manager = WodTokenManager.getInstance();
        await manager.removeVisualRule(this.document, ruleId);
        this.render(true);
    }

    async _onToggleRule(ruleId, enabled) {
        const manager = WodTokenManager.getInstance();
        await manager.updateVisualRule(this.document, ruleId, { enabled });
    }

    async _onSaveAll(html) {
        const rules = [];
        html.find('.visual-rule-row').each((i, el) => {
            const $row = $(el);
            const ruleId = $row.data('rule-id');
            const condType = $row.find('.condition-type-select').val();
            const property = $row.find('.property-type-select').val();

            // Parse condition params based on type
            const params = {};
            if (condType === 'isIlluminated') {
                params.ignoreSelf = $row.find('.param-ignore-self').is(':checked');
            } else if (condType === 'hasEffect') {
                params.effectName = $row.find('.param-effect-name').val() || '';
            } else if (condType === 'attributeThreshold') {
                params.path = $row.find('.param-attr-path').val() || '';
                params.operator = $row.find('.param-attr-operator').val() || '<';
                params.value = Number($row.find('.param-attr-value').val()) || 0;
            }

            // Parse values based on property type
            let activeValue, inactiveValue;
            if (property === 'tint') {
                activeValue = $row.find('.active-value-input').val() || '#ffffff';
                inactiveValue = $row.find('.inactive-value-input').val() || '#ffffff';
            } else {
                activeValue = Number($row.find('.active-value-input').val());
                inactiveValue = Number($row.find('.inactive-value-input').val());
                if (isNaN(activeValue)) activeValue = property === 'opacity' ? 1.0 : 1.0;
                if (isNaN(inactiveValue)) inactiveValue = property === 'opacity' ? 0.0 : 1.0;
            }

            const duration = Number($row.find('.transition-duration').val()) || 500;

            rules.push({
                id: ruleId,
                enabled: $row.find('.rule-enabled-toggle').is(':checked'),
                condition: { type: condType, params },
                property,
                activeValue,
                inactiveValue,
                transition: { duration, easing: 'linear' }
            });
        });

        // Safe flag replacement
        await this.document.unsetFlag('wodsystem', 'visualRules');
        if (rules.length > 0) {
            await this.document.setFlag('wodsystem', 'visualRules', rules);
        }

        ui.notifications?.info(`Saved ${rules.length} visual rule(s)`);
        this.render(true);
    }

    async _updateObject(event, formData) {
        // Handled by _onSaveAll
    }
}
