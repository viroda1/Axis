```markdown
# How to use extensions in Axis

## What is an extension in Axis
An extension in Axis is basically a custom website that runs inside Axis and can interact with websites just like any other browser extension.

## Making an extension
To make an extension you need at least two essential files:
1. `manifest.json`
2. `popup.html`

You can find examples of both files in this folder. Making the extension itself is just like making any other website.

## Importing extensions
To import an extension, upload your folder containing the extension files in the Settings panel, accessed via the gear button.

> **Only import extensions you trust.** If anyone has shared an extension with you, make sure to double-check it. Extensions can run malicious scripts to steal your data or make the site unusable. Import at your own risk.

## Other info
The extension system is currently in beta. Here are some features planned for future updates:
1. `background.js` that runs on start
2. `axis://extensions` page to manage extensions
3. Site interactivity (custom JavaScript inside proxied pages)
