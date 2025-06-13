# Rulespedia CSS Structure

This folder contains the modular CSS files for the Rulespedia system, organized for better maintainability and faster processing.

## File Structure

### Main File
- `rulespedia.css` - Main CSS file that imports all modular components

### Modular Components
- `base.css` - Base layout and container styles
- `views.css` - View headers, content, and navigation styles
- `search.css` - Search input, textarea, and result display styles
- `buttons.css` - Action buttons and interactive elements
- `import.css` - Import view styles (upload area, progress bars)
- `manage.css` - Manage view styles (book lists, management actions)

## Benefits

1. **Faster Processing** - Smaller files are processed more quickly
2. **Better Organization** - Related styles are grouped together
3. **Easier Maintenance** - Changes to specific components are isolated
4. **Modular Development** - New components can be added without affecting existing styles

## Usage

The main `rulespedia.css` file automatically imports all modular components. When making changes:

1. **Layout changes** → Edit `base.css`
2. **View navigation** → Edit `views.css`
3. **Search functionality** → Edit `search.css`
4. **Button styling** → Edit `buttons.css`
5. **Import features** → Edit `import.css`
6. **Management features** → Edit `manage.css`

## Adding New Components

To add a new component:

1. Create a new CSS file (e.g., `new-component.css`)
2. Add the import to `rulespedia.css`
3. Add your styles to the new file

Example:
```css
/* In rulespedia.css */
@import url('./new-component.css');

/* In new-component.css */
.tab.sidebar-tab.rulespedia-sidebar.directory.flexcol .new-component {
    /* Your styles here */
}
``` 