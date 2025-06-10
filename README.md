# World of Darkness System for Foundry VTT

A comprehensive Foundry VTT system for running World of Darkness games, featuring a flexible hierarchical trait system that supports Mortal, Vampire, Demon, and other creature types.

## 🎯 Features

### Current Implementation
- **Mortal Character Support** - Complete character sheet with all core traits
- **Hierarchical Trait System** - Template-driven trait inheritance and customization
- **Responsive Character Sheet** - Clean, modern interface that adapts to different screen sizes
- **Dot-based Interface** - Classic WoD dot system for attributes and abilities
- **Health Checkbox System** - Square checkboxes for tracking health levels
- **Dynamic Trait Creation** - Automatic trait initialization from templates
- **Template-driven Architecture** - All game data defined in JSON templates

### Trait System
- **Attributes**: Physical, Social, and Mental (1-5 dots)
- **Abilities**: Talents, Skills, and Knowledges (0-5 dots)
- **Advantages**: Backgrounds, Virtues, and Numina
- **Miscellaneous**: Humanity, Willpower, Health, Merits, and Flaws

### Creature Types
- **Mortal**: Base character type with all standard traits
- **Vampire**: Adds Disciplines, Blood pool, and vampire-specific abilities
- **Demon**: Adds Powers, Essence pool, and demon-specific abilities

## 🚀 Installation

### Manual Installation
1. Download or clone this repository
2. Extract the files to your Foundry VTT `Data/systems/` directory
3. Restart Foundry VTT
4. Create a new world and select "World of Darkness" as the system

### From GitHub
```bash
cd /path/to/FoundryVTT/Data/systems/
git clone https://github.com/jibanezg/wodsystem.git
```

## 📁 Project Structure

```
wodsystem/
├── wodsystem.js                 # Main system entry point
├── system.json                  # System metadata and compatibility
├── template.json               # Hierarchical trait definitions
├── README.md                   # This file
├── .gitignore                  # Git ignore rules
├── lang/
│   └── en.json                # English localization
├── module/
│   └── actor/
│       ├── data/
│       │   └── wod-actor.js    # Actor data model and lifecycle
│       ├── scripts/
│       │   └── trait-factory.js # Hierarchical trait creation
│       └── template/
│           ├── mortal-sheet.js # Mortal character sheet class
│           ├── mortal-sheet.html # Mortal sheet template
│           └── mortal-sheet.css # Mortal sheet styles
├── styles/
│   └── mortal-sheet.css        # Global styles
└── templates/
    └── actor/
        └── mortal-sheet.html   # Template file (Foundry requirement)
```

## 🎮 Usage

### Creating Characters
1. Create a new Actor in Foundry VTT
2. Select "Mortal" as the character type
3. The system will automatically initialize all traits from the template
4. Use the dot interface to set attribute and ability values
5. Use the health checkboxes to track current health levels

### Character Sheet Features
- **Click dots** to set attribute and ability values
- **Click health checkboxes** to track damage
- **Add/Remove Merits and Flaws** dynamically
- **Responsive layout** works on different screen sizes

## 🔧 Technical Details

### System Requirements
- **Foundry VTT**: Version 11.x or higher
- **Browser**: Modern web browser with JavaScript enabled

### Architecture
- **Template-driven**: All game data defined in `template.json`
- **Hierarchical inheritance**: Creature types inherit from base traits
- **Dynamic initialization**: Traits created automatically from templates
- **Responsive design**: CSS Grid and Flexbox for modern layouts

### Key Components
- **TraitFactory**: Handles trait creation and inheritance
- **WodActor**: Manages actor data and lifecycle
- **MortalSheet**: Character sheet implementation
- **Template System**: JSON-based trait definitions

## 🛠️ Development

### Adding New Creature Types
1. Add the creature type to `template.json` under `Actor.types`
2. Define creature traits in `Actor.creatureTypes`
3. Create character sheet files if needed
4. Register the sheet in `wodsystem.js`

### Example: Adding Werewolf
```json
{
  "Actor": {
    "types": ["Mortal", "Vampire", "Demon", "Werewolf"],
    "creatureTypes": {
      "Werewolf": {
        "name": "Werewolf",
        "label": "Werewolf",
        "traits": {
          "inherit": "baseTraits",
          "add": {
            "advantages": {
              "numina": {
                "Gifts": { /* Werewolf gifts */ }
              }
            },
            "miscellaneous": {
              "rage": { "current": 5, "maximum": 5 }
            }
          }
        }
      }
    }
  }
}
```

### Localization
- Edit `lang/en.json` to add new text strings
- Use the `game.i18n.localize()` function in JavaScript
- Template variables use `{{game.i18n.localize('KEY')}}`

## 🐛 Troubleshooting

### Common Issues
- **Character sheet not loading**: Check browser console for JavaScript errors
- **Traits not initializing**: Ensure `template.json` is valid JSON
- **Health checkboxes not working**: Check that actor data is properly structured

### Debug Mode
Enable browser developer tools to see detailed error messages and system logs.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Foundry VTT Community**: Join the Foundry Discord for general support
- **Documentation**: Check the code comments for implementation details

## 🔮 Roadmap

### Planned Features
- [ ] Werewolf character support
- [ ] Mage character support
- [ ] Changeling character support
- [ ] Combat system integration
- [ ] Dice rolling system
- [ ] Supernatural form transformations
- [ ] Character import/export
- [ ] Module compatibility

### Version History
- **v1.0.0**: Initial release with Mortal, Vampire, and Demon support
- **v1.1.0**: Added health checkbox system and responsive design
- **v1.2.0**: Improved trait inheritance and template system

---

**Made with ❤️ for the World of Darkness community** 