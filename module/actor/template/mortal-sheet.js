export class MortalSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "mortal"],
            template: "systems/wodsystem/templates/actor/mortal-sheet.html",
            width: 800,
            height: 600
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Dot click handlers
        html.find('.dot').click(this._onDotClick.bind(this));

        // Health checkbox handlers
        html.find('.health-checkbox').click(this._onHealthCheckboxClick.bind(this));

        // Add Merit
        html.find('.add-merit').click(this._onAddMerit.bind(this));

        // Delete Merit
        html.find('.delete-merit').click(this._onDeleteMerit.bind(this));

        // Add Flaw
        html.find('.add-flaw').click(this._onAddFlaw.bind(this));

        // Delete Flaw
        html.find('.delete-flaw').click(this._onDeleteFlaw.bind(this));
    }

    async _onDotClick(event) {
        event.preventDefault();
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        const index = parseInt(dot.dataset.index);
        const currentValue = this._getCurrentValue(container);
        
        // Toggle the clicked dot
        let newValue;
        if (index + 1 === currentValue) {
            // If clicking the last filled dot, decrease by 1
            newValue = Math.max(currentValue - 1, 0);
        } else {
            // Otherwise, set to the clicked position
            newValue = index + 1;
        }

        // Determine what type of dot this is
        let updatePromise;
        if (container.dataset.attribute) {
            updatePromise = this._updateAttribute(container.dataset.attribute, container.dataset.key, newValue);
        } else if (container.dataset.ability) {
            updatePromise = this._updateAbility(container.dataset.ability, container.dataset.key, newValue);
        } else if (container.dataset.willpower) {
            updatePromise = this._updateWillpower(container.dataset.willpower, newValue);
        } else if (container.dataset.merit) {
            updatePromise = this._updateMerit(container.dataset.merit, newValue);
        } else if (container.dataset.flaw) {
            updatePromise = this._updateFlaw(container.dataset.flaw, newValue);
        } else if (container.dataset.health) {
            updatePromise = this._updateHealth(container.dataset.health, newValue);
        }

        // Update the visual appearance immediately
        this._updateDotVisuals(container, newValue);
        
        // Wait for the data update to complete
        if (updatePromise) {
            await updatePromise;
        }
    }

    async _onHealthCheckboxClick(event) {
        event.preventDefault();
        const checkbox = event.currentTarget;
        const container = checkbox.closest('.checkbox-container');
        const index = parseInt(checkbox.dataset.index);
        const currentValue = this._getCurrentHealthValue(container);
        
        // Toggle the clicked checkbox
        let newValue;
        if (index + 1 === currentValue) {
            // If clicking the last checked checkbox, decrease by 1
            newValue = Math.max(currentValue - 1, 0);
        } else {
            // Otherwise, set to the clicked position
            newValue = index + 1;
        }
        
        // Update the visual appearance immediately
        this._updateHealthCheckboxVisuals(container, newValue);
        
        // Update the data
        await this._updateHealth(container.dataset.health, newValue);
    }

    _getCurrentValue(container) {
        // Get the current value from the hidden input
        const input = container.querySelector('.dot-input');
        return parseInt(input.value) || 0;
    }

    _getCurrentHealthValue(container) {
        // Get the current value from the hidden health input
        const input = container.querySelector('.health-input');
        return parseInt(input.value) || 0;
    }

    _updateHealthCheckboxVisuals(container, newValue) {
        const checkboxes = container.querySelectorAll('.health-checkbox');
        const input = container.querySelector('.health-input');
        
        // Update the hidden input value
        input.value = newValue;
        
        // Update the visual state of each checkbox
        checkboxes.forEach((checkbox, index) => {
            if (index < newValue) {
                checkbox.classList.add('checked');
            } else {
                checkbox.classList.remove('checked');
            }
        });
    }

    async _updateAttribute(category, key, value) {
        const updateData = {};
        updateData[`system.attributes.${category}.${key}`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    async _updateAbility(category, key, value) {
        const updateData = {};
        updateData[`system.abilities.${category}.${key}`] = Math.min(Math.max(value, 0), 5);
        await this.actor.update(updateData, { render: false });
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    async _updateWillpower(type, value) {
        const maxValue = type === 'temporary' ? this.actor.system.advantages.willpower.permanent : 10;
        const updateData = {};
        updateData[`system.advantages.willpower.${type}`] = Math.min(Math.max(value, 0), maxValue);
        await this.actor.update(updateData, { render: false });
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    async _updateMerit(index, value) {
        const updateData = {};
        updateData[`system.advantages.merits.${index}.value`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    async _updateFlaw(index, value) {
        const updateData = {};
        updateData[`system.advantages.flaws.${index}.value`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    async _updateHealth(type, value) {
        const maxValue = type === 'current' ? this.actor.system.miscellaneous.health.maximum : 10;
        const updateData = {};
        updateData[`system.miscellaneous.health.${type}`] = Math.min(Math.max(value, 0), maxValue);
        
        await this.actor.update(updateData, { render: false });
        
        // Manually sync visual state after update
        this._syncVisualStateWithData();
    }

    _updateDotVisuals(container, newValue) {
        const dots = container.querySelectorAll('.dot');
        const input = container.querySelector('.dot-input');
        
        // Update the hidden input value
        input.value = newValue;
        
        // Update the visual state of each dot
        dots.forEach((dot, index) => {
            if (index < newValue) {
                dot.classList.add('filled');
                // Try multiple approaches to set the background
                dot.style.setProperty('background-color', '#800000', 'important');
                dot.style.backgroundColor = '#800000';
                dot.setAttribute('style', dot.getAttribute('style') + '; background-color: #800000 !important;');
            } else {
                dot.classList.remove('filled');
                // Try multiple approaches to set the background
                dot.style.setProperty('background-color', 'white', 'important');
                dot.style.backgroundColor = 'white';
                dot.setAttribute('style', dot.getAttribute('style') + '; background-color: white !important;');
            }
        });
    }

    async _onAddMerit(event) {
        event.preventDefault();
        const merits = this.actor.system.advantages.merits;
        merits.push({ name: "", value: 1 });
        await this.actor.update({ "system.advantages.merits": merits });
    }

    async _onDeleteMerit(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const merits = this.actor.system.advantages.merits;
        merits.splice(index, 1);
        await this.actor.update({ "system.advantages.merits": merits });
    }

    async _onAddFlaw(event) {
        event.preventDefault();
        const flaws = this.actor.system.advantages.flaws;
        flaws.push({ name: "", value: 1 });
        await this.actor.update({ "system.advantages.flaws": flaws });
    }

    async _onDeleteFlaw(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const flaws = this.actor.system.advantages.flaws;
        flaws.splice(index, 1);
        await this.actor.update({ "system.advantages.flaws": flaws });
    }

    /** @override */
    async _render(force = false, options = {}) {
        const result = await super._render(force, options);
        
        // After rendering, sync the visual state with the actual data
        if (this.element) {
            this._syncVisualStateWithData();
        }
        
        return result;
    }

    _syncVisualStateWithData() {
        // Sync all dot containers with the actual actor data
        const containers = this.element.find('.dot-container');
        
        containers.each((index, container) => {
            const $container = $(container);
            const input = $container.find('.dot-input')[0];
            if (input) {
                const currentValue = parseInt(input.value) || 0;
                this._updateDotVisuals($container[0], currentValue);
            }
        });
        
        // Sync all health checkbox containers with the actual actor data
        const healthContainers = this.element.find('.checkbox-container');
        
        healthContainers.each((index, container) => {
            const $container = $(container);
            const input = $container.find('.health-input')[0];
            if (input) {
                const currentValue = parseInt(input.value) || 0;
                this._updateHealthCheckboxVisuals($container[0], currentValue);
            }
        });
    }
} 