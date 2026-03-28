/**
 * TriggerEventRegistry - Central registry of all event types and document type mappings
 * This is the single source of truth for which events are available for which document types
 */
export class TriggerEventRegistry {
    static instance = null;
    
    constructor() {
        this._documentTypes = this._initDocumentTypes();
        this._events = this._initEvents();
        this._conditionTypes = this._initConditionTypes();
        this._targetModes = this._initTargetModes();
    }
    
    /**
     * Get the singleton instance
     * @returns {TriggerEventRegistry}
     */
    static getInstance() {
        if (!TriggerEventRegistry.instance) {
            TriggerEventRegistry.instance = new TriggerEventRegistry();
        }
        return TriggerEventRegistry.instance;
    }
    
    /**
     * Initialize document types with their configurations
     * @private
     */
    _initDocumentTypes() {
        return {
            tile: {
                id: 'tile',
                label: 'Tile',
                description: 'Triggers anchored to map tiles',
                supportsProximity: true,
                flagPath: 'wodsystem.triggers',
                icon: 'fa-image'
            },
            region: {
                id: 'region',
                label: 'Region',
                description: 'Triggers anchored to drawn regions',
                supportsProximity: true,
                flagPath: 'wodsystem.triggers',
                icon: 'fa-draw-polygon'
            },
            wall: {
                id: 'wall',
                label: 'Wall/Door',
                description: 'Triggers anchored to walls and doors',
                supportsProximity: false,
                flagPath: 'wodsystem.triggers',
                icon: 'fa-door-open'
            },
            actor: {
                id: 'actor',
                label: 'Actor',
                description: 'Triggers anchored to actors (global, persist across scenes)',
                supportsProximity: false,
                flagPath: 'wodsystem.triggers',
                icon: 'fa-user'
            },
            light: {
                id: 'light',
                label: 'Ambient Light',
                description: 'Triggers anchored to ambient lights',
                supportsProximity: false,
                flagPath: 'wodsystem.triggers',
                icon: 'fa-lightbulb'
            },
            scene: {
                id: 'scene',
                label: 'Scene',
                description: 'Scene-wide triggers without spatial anchor',
                supportsProximity: false,
                flagPath: 'wodsystem.sceneTriggers',
                icon: 'fa-map'
            }
        };
    }
    
    /**
     * Initialize all event types with their document type mappings
     * @private
     */
    _initEvents() {
        return {
            // Tile/Region events
            onEnter: {
                id: 'onEnter',
                label: 'Token Enters',
                description: 'Fires when a token enters the trigger area',
                documentTypes: ['tile', 'region'],
                category: 'movement'
            },
            onExit: {
                id: 'onExit',
                label: 'Token Exits',
                description: 'Fires when a token exits the trigger area',
                documentTypes: ['tile', 'region'],
                category: 'movement'
            },
            onProximity: {
                id: 'onProximity',
                label: 'Token Approaches',
                description: 'Fires when a token comes within proximity distance',
                documentTypes: ['tile', 'region'],
                category: 'movement',
                requiresProximity: true
            },
            onEffect: {
                id: 'onEffect',
                label: 'Effect Applied',
                description: 'Fires when an effect is applied to a token in the area',
                documentTypes: ['tile', 'region'],
                category: 'effect'
            },
            
            // Wall/Door events
            onDoorOpened: {
                id: 'onDoorOpened',
                label: 'Door Opened',
                description: 'Fires when a door is opened',
                documentTypes: ['wall', 'scene'],
                category: 'door'
            },
            onDoorClosed: {
                id: 'onDoorClosed',
                label: 'Door Closed',
                description: 'Fires when a door is closed',
                documentTypes: ['wall', 'scene'],
                category: 'door'
            },
            onDoorLocked: {
                id: 'onDoorLocked',
                label: 'Door Locked',
                description: 'Fires when a door is locked',
                documentTypes: ['wall', 'scene'],
                category: 'door'
            },
            onDoorUnlocked: {
                id: 'onDoorUnlocked',
                label: 'Door Unlocked',
                description: 'Fires when a door is unlocked',
                documentTypes: ['wall', 'scene'],
                category: 'door'
            },
            
            // Ambient Light events
            onLightEnabled: {
                id: 'onLightEnabled',
                label: 'Light Enabled',
                description: 'Fires when an ambient light is made visible',
                documentTypes: ['light'],
                category: 'light'
            },
            onLightDisabled: {
                id: 'onLightDisabled',
                label: 'Light Disabled',
                description: 'Fires when an ambient light is hidden',
                documentTypes: ['light'],
                category: 'light'
            },
            onLightChanged: {
                id: 'onLightChanged',
                label: 'Light Changed',
                description: 'Fires when an ambient light property changes',
                documentTypes: ['light'],
                category: 'light'
            },

            // Actor events (global)
            onEffectApplied: {
                id: 'onEffectApplied',
                label: 'Effect Applied',
                description: 'Fires when an effect is applied to this actor (global)',
                documentTypes: ['actor'],
                category: 'effect'
            },
            onEffectRemoved: {
                id: 'onEffectRemoved',
                label: 'Effect Removed',
                description: 'Fires when an effect is removed from this actor (global)',
                documentTypes: ['actor'],
                category: 'effect'
            },
            onHealthChanged: {
                id: 'onHealthChanged',
                label: 'Health Changed',
                description: 'Fires when the actor\'s health changes (global)',
                documentTypes: ['actor'],
                category: 'attribute'
            },
            onAttributeChanged: {
                id: 'onAttributeChanged',
                label: 'Attribute Changed',
                description: 'Fires when any actor attribute changes (global)',
                documentTypes: ['actor'],
                category: 'attribute'
            },
            
            // Scene-wide events
            onAnyDoorOpened: {
                id: 'onAnyDoorOpened',
                label: 'Any Door Opened',
                description: 'Fires when any door in the scene is opened',
                documentTypes: ['scene'],
                category: 'door'
            },
            onAnyDoorClosed: {
                id: 'onAnyDoorClosed',
                label: 'Any Door Closed',
                description: 'Fires when any door in the scene is closed',
                documentTypes: ['scene'],
                category: 'door'
            },
            onCombatStart: {
                id: 'onCombatStart',
                label: 'Combat Starts',
                description: 'Fires when combat begins',
                documentTypes: ['scene'],
                category: 'combat'
            },
            onCombatEnd: {
                id: 'onCombatEnd',
                label: 'Combat Ends',
                description: 'Fires when combat ends',
                documentTypes: ['scene'],
                category: 'combat'
            },
            onRoundStart: {
                id: 'onRoundStart',
                label: 'Round Starts',
                description: 'Fires at the start of each combat round',
                documentTypes: ['scene'],
                category: 'combat'
            },
            onRoundEnd: {
                id: 'onRoundEnd',
                label: 'Round Ends',
                description: 'Fires at the end of each combat round',
                documentTypes: ['scene'],
                category: 'combat'
            },
            onTimeChange: {
                id: 'onTimeChange',
                label: 'Time Changes',
                description: 'Fires when in-game time changes (requires Simple Calendar)',
                documentTypes: ['scene'],
                category: 'time'
            }
        };
    }
    
    /**
     * Initialize condition types
     * @private
     */
    _initConditionTypes() {
        return {
            hasEffect: {
                id: 'hasEffect',
                label: 'Has Effect',
                description: 'Checks if token has a specific effect applied',
                category: 'effect',
                requiresValue: true,
                valueType: 'effectName'
            },
            removedEffect: {
                id: 'removedEffect',
                label: 'Removed Effect',
                description: 'Checks if a specific effect was just removed (for onEffectRemoved events)',
                category: 'effect',
                requiresValue: true,
                valueType: 'effectName'
            },
            isGM: {
                id: 'isGM',
                label: 'Is GM',
                description: 'Checks if the token is controlled by a GM',
                category: 'ownership',
                requiresValue: false
            },
            isPlayer: {
                id: 'isPlayer',
                label: 'Is Player',
                description: 'Checks if the token is controlled by a player',
                category: 'ownership',
                requiresValue: false
            },
            doorState: {
                id: 'doorState',
                label: 'Door State',
                description: 'Checks the state of a door',
                category: 'environment',
                requiresValue: true,
                valueType: 'doorState',
                valueOptions: ['open', 'closed', 'locked']
            },
            healthPercent: {
                id: 'healthPercent',
                label: 'Health Percent',
                description: 'Checks token health percentage',
                category: 'attribute',
                requiresValue: true,
                valueType: 'number'
            },
            tokenAttribute: {
                id: 'tokenAttribute',
                label: 'Token Attribute',
                description: 'Checks a specific token attribute value',
                category: 'attribute',
                requiresValue: true,
                valueType: 'attributePath'
            },
            actorType: {
                id: 'actorType',
                label: 'Actor Type',
                description: 'Checks the actor type (e.g., character, npc)',
                category: 'identity',
                requiresValue: true,
                valueType: 'actorType'
            },
            distance: {
                id: 'distance',
                label: 'Distance',
                description: 'Checks the distance from trigger origin',
                category: 'spatial',
                requiresValue: true,
                valueType: 'number'
            }
        };
    }
    
    /**
     * Initialize target modes for actions
     * @private
     */
    _initTargetModes() {
        return {
            self: {
                id: 'self',
                label: 'Self',
                description: 'The document the trigger is anchored to'
            },
            triggering: {
                id: 'triggering',
                label: 'Triggering Actor',
                description: 'The actor that triggered the event'
            },
            specific: {
                id: 'specific',
                label: 'Specific Target',
                description: 'A specific chosen document'
            },
            all: {
                id: 'all',
                label: 'All Matching',
                description: 'All documents matching a filter'
            }
        };
    }
    
    // ==================== Query Methods ====================
    
    /**
     * Get all document types
     * @returns {Object}
     */
    getDocumentTypes() {
        return { ...this._documentTypes };
    }
    
    /**
     * Get a specific document type
     * @param {string} typeId
     * @returns {Object|null}
     */
    getDocumentType(typeId) {
        return this._documentTypes[typeId] || null;
    }
    
    /**
     * Detect document type from a Foundry document
     * @param {Document} document
     * @returns {string|null}
     */
    detectDocumentType(document) {
        if (!document) return null;
        
        // Check by document class name
        const className = document.constructor.name;
        
        if (className === 'TileDocument' || document.documentName === 'Tile') {
            return 'tile';
        }
        if (className === 'RegionDocument' || document.documentName === 'Region') {
            return 'region';
        }
        if (className === 'WallDocument' || document.documentName === 'Wall') {
            return 'wall';
        }
        if (className === 'Actor' || document.documentName === 'Actor') {
            return 'actor';
        }
        if (className === 'AmbientLightDocument' || document.documentName === 'AmbientLight') {
            return 'light';
        }
        if (className === 'Scene' || document.documentName === 'Scene') {
            return 'scene';
        }
        
        return null;
    }
    
    /**
     * Get all events for a specific document type
     * @param {string} documentType
     * @returns {Object[]}
     */
    getEventsForDocumentType(documentType) {
        const events = [];
        for (const [id, event] of Object.entries(this._events)) {
            if (event.documentTypes.includes(documentType)) {
                events.push({ ...event });
            }
        }
        return events;
    }
    
    /**
     * Get a specific event
     * @param {string} eventId
     * @returns {Object|null}
     */
    getEvent(eventId) {
        return this._events[eventId] || null;
    }
    
    /**
     * Check if an event is valid for a document type
     * @param {string} eventId
     * @param {string} documentType
     * @returns {boolean}
     */
    isEventValidForDocumentType(eventId, documentType) {
        const event = this._events[eventId];
        if (!event) return false;
        return event.documentTypes.includes(documentType);
    }
    
    /**
     * Get all condition types
     * @returns {Object}
     */
    getConditionTypes() {
        return { ...this._conditionTypes };
    }
    
    /**
     * Get a specific condition type
     * @param {string} typeId
     * @returns {Object|null}
     */
    getConditionType(typeId) {
        return this._conditionTypes[typeId] || null;
    }
    
    /**
     * Get all target modes
     * @returns {Object}
     */
    getTargetModes() {
        return { ...this._targetModes };
    }
    
    /**
     * Check if a document type supports proximity
     * @param {string} documentType
     * @returns {boolean}
     */
    supportsProximity(documentType) {
        const docType = this._documentTypes[documentType];
        return docType?.supportsProximity || false;
    }
    
    /**
     * Get the default event for a document type
     * @param {string} documentType
     * @returns {string}
     */
    getDefaultEvent(documentType) {
        const events = this.getEventsForDocumentType(documentType);
        return events.length > 0 ? events[0].id : 'onEnter';
    }
    
    /**
     * Get events grouped by category
     * @param {string} documentType
     * @returns {Object}
     */
    getEventsByCategory(documentType) {
        const events = this.getEventsForDocumentType(documentType);
        const grouped = {};
        
        for (const event of events) {
            const category = event.category || 'other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(event);
        }
        
        return grouped;
    }
}
