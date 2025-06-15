# Rulespedia Framework Documentation

## Overview

The Rulespedia Framework is a class-based system for creating and managing views in the Rulespedia tab. It provides a clean, extensible architecture for adding new functionality to the Rulespedia interface.

## Core Components

### 1. RuleView Base Class

The `RuleView` class is the foundation of the framework. All views must extend this class.

#### Constructor Parameters
- `name` (string): Unique identifier for the view
- `title` (string): Display title for the view
- `icon` (string): FontAwesome icon class (default: 'fas fa-folder')

#### Key Methods

**`setTemplate(template)`**
- Sets the HTML template for the view
- `template` (string): HTML template string

**`setTemplatePath(templatePath)`**
- Sets the path to an external HTML template file
- `templatePath` (string): Path to the HTML file

**`async loadTemplate()`**
- Loads the template from file or uses the set template
- Called automatically during rendering

**`async render(container)`**
- Renders the view into the specified container
- `container` (HTMLElement): DOM element to render into

**`onRender()`**
- Called after the view is rendered
- Override this method to add view-specific logic

**`onActivate()`**
- Called when the view becomes active
- Override this method for activation logic

**`onDeactivate()`**
- Called when the view is deactivated
- Override this method for cleanup logic

**`getBreadcrumbData()`**
- Returns breadcrumb information for the view
- Returns: `{name, title, icon}` object

### 2. ViewManager

The `ViewManager` handles registration and navigation between views.

#### Key Methods

**`registerView(view)`**
- Registers a view with the manager
- `view` (RuleView): View instance to register

**`getView(name)`**
- Gets a view by name
- `name` (string): View name
- Returns: RuleView instance or undefined

**`async navigateToView(viewName)`**
- Navigates to a specific view
- `viewName` (string): Name of the view to navigate to
- Returns: boolean indicating success

**`getBreadcrumbHTML(viewName, parentView)`**
- Generates breadcrumb HTML for a view
- `viewName` (string): Current view name
- `parentView` (string): Parent view name (optional)
- Returns: HTML string

## Creating a New View

### Step 1: Create the View Class

```javascript
class MyCustomView extends RuleView {
    constructor() {
        super('myview', 'My Custom View', 'fas fa-star');
        
        // Set the template
        this.setTemplate(`
            <div class="view-header">
                <button class="back-button" data-back="home">
                    <i class="fas fa-arrow-left"></i>
                    Back to Home
                </button>
                <h3>My Custom View</h3>
            </div>
            <div class="view-content">
                <div class="my-content">
                    <h4>Welcome to my custom view!</h4>
                    <p>This is where your content goes.</p>
                    <button class="action-button primary" id="my-button">
                        <i class="fas fa-check"></i>
                        My Action
                    </button>
                </div>
            </div>
        `);
    }

    onRender() {
        // Set up event listeners
        const myButton = this.container.querySelector('#my-button');
        if (myButton) {
            myButton.addEventListener('click', () => this.handleMyAction());
        }

        // Set up back button
        const backButton = this.container.querySelector('.back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (window.rulespediaManager) {
                    window.rulespediaManager.navigateToView('home');
                }
            });
        }
    }

    handleMyAction() {
        console.log('My action triggered!');
        // Add your custom logic here
    }
}
```

### Step 2: Register the View

In `scripts/rulespedia.js`, add your view to the `registerViews()` method:

```javascript
registerViews() {
    console.log('Rulespedia: Registering views...');
    
    // Register the view classes
    this.viewManager.registerView(new HomeView());
    this.viewManager.registerView(new ImportView());
    this.viewManager.registerView(new ManageView());
    this.viewManager.registerView(new SettingsView());
    this.viewManager.registerView(new MyCustomView()); // Add your view here
    
    console.log('Rulespedia: Views registered');
}
```

### Step 3: Add Navigation

Add a button to navigate to your view. For example, in the HomeView:

```javascript
// In HomeView template
<button class="action-button secondary" data-view="myview">
    <i class="fas fa-star"></i>
    My Custom View
</button>
```

### Step 4: Add View Container (if needed)

If your view needs a specific container, add it to `templates/rulespedia/rulespedia-tab.html`:

```html
<div class="rulespedia-view" data-view="myview">
    <div class="view-content">
        <!-- My custom view content will be rendered here -->
    </div>
</div>
```

## Using External Templates

Instead of embedding HTML in your JavaScript, you can use external template files:

### Step 1: Create Template File

Create `templates/rulespedia/myview.html`:

```html
<div class="view-header">
    <button class="back-button" data-back="home">
        <i class="fas fa-arrow-left"></i>
        Back to Home
    </button>
    <h3>My Custom View</h3>
</div>
<div class="view-content">
    <div class="my-content">
        <h4>Welcome to my custom view!</h4>
        <p>This content is loaded from an external file.</p>
    </div>
</div>
```

### Step 2: Set Template Path

```javascript
class MyCustomView extends RuleView {
    constructor() {
        super('myview', 'My Custom View', 'fas fa-star');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/myview.html');
    }
}
```

## Navigation Patterns

### Basic Navigation

```javascript
// Navigate to a view
if (window.rulespediaManager) {
    window.rulespediaManager.navigateToView('home');
}
```

### Back Button Pattern

```javascript
const backButton = this.container.querySelector('.back-button');
if (backButton) {
    backButton.addEventListener('click', () => {
        if (window.rulespediaManager) {
            window.rulespediaManager.navigateToView('home');
        }
    });
}
```

### Action Button Pattern

```javascript
const actionButtons = this.container.querySelectorAll('.action-button');
actionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const targetView = e.currentTarget.dataset.view;
        if (targetView && window.rulespediaManager) {
            window.rulespediaManager.navigateToView(targetView);
        }
    });
});
```

## Accessing System Components

### Content Store

```javascript
const contentStore = window.rulespediaManager.getContentStore();
if (contentStore) {
    // Use content store
    const results = await contentStore.search(query, 5);
}
```

### View Manager

```javascript
const viewManager = window.rulespediaManager.getViewManager();
if (viewManager) {
    // Access view manager directly
    const currentView = viewManager.getCurrentView();
}
```

## CSS Styling

Views automatically inherit the Material Design styling from `styles/rulespedia/rulespedia.css`. Common classes include:

- `.view-header`: Header section with back button and title
- `.view-content`: Main content area
- `.action-button`: Standard button styling
- `.action-button.primary`: Primary action button
- `.action-button.secondary`: Secondary action button
- `.action-button.danger`: Danger/destructive action button
- `.card-header`: Card header section
- `.card-content`: Card content section

## Best Practices

1. **Always extend RuleView**: Never create views without extending the base class
2. **Use consistent naming**: Use lowercase, descriptive names for view identifiers
3. **Handle errors gracefully**: Always check if `window.rulespediaManager` exists before using it
4. **Clean up event listeners**: Use `onDeactivate()` for cleanup if needed
5. **Use semantic HTML**: Structure your templates with proper HTML semantics
6. **Follow the navigation patterns**: Use the established patterns for consistency
7. **Test thoroughly**: Test navigation, event handling, and error cases

## Example: Complete Custom View

Here's a complete example of a custom view that demonstrates all the patterns:

```javascript
class ExampleView extends RuleView {
    constructor() {
        super('example', 'Example View', 'fas fa-lightbulb');
        
        this.setTemplate(`
            <div class="view-header">
                <button class="back-button" data-back="home">
                    <i class="fas fa-arrow-left"></i>
                    Back to Home
                </button>
                <h3>Example View</h3>
            </div>
            <div class="view-content">
                <div class="example-section">
                    <div class="example-card">
                        <div class="card-header">
                            <i class="fas fa-info-circle"></i>
                            <h4>Example Card</h4>
                        </div>
                        <div class="card-content">
                            <p>This is an example of a custom view using the framework.</p>
                            <div class="form-group">
                                <label for="example-input">Example Input:</label>
                                <input type="text" id="example-input" class="setting-input" placeholder="Enter text...">
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="action-button primary" id="example-action">
                            <i class="fas fa-play"></i>
                            Run Example
                        </button>
                        <button class="action-button secondary" data-view="home">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    onRender() {
        // Set up back button
        const backButton = this.container.querySelector('.back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (window.rulespediaManager) {
                    window.rulespediaManager.navigateToView('home');
                }
            });
        }

        // Set up action buttons
        const exampleButton = this.container.querySelector('#example-action');
        const cancelButton = this.container.querySelector('.action-button.secondary');
        
        if (exampleButton) {
            exampleButton.addEventListener('click', () => this.handleExampleAction());
        }
        
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                if (window.rulespediaManager) {
                    window.rulespediaManager.navigateToView('home');
                }
            });
        }
    }

    handleExampleAction() {
        const input = this.container.querySelector('#example-input');
        const value = input ? input.value : '';
        
        if (value.trim()) {
            console.log('Example action triggered with value:', value);
            alert(`Example action completed with: ${value}`);
        } else {
            alert('Please enter some text first.');
        }
    }

    onActivate() {
        console.log('Example view activated');
    }

    onDeactivate() {
        console.log('Example view deactivated');
    }
}
```

This framework provides a solid foundation for building complex, maintainable views in the Rulespedia system. By following these patterns and best practices, you can easily extend the functionality of Rulespedia with new views and features. 