# THIS EXTENSION IS DEPRECATED

This extension is no longer maintained, but there is a new one [here](https://marketplace.visualstudio.com/items?itemName=0tickpulse.mythic-analyzer-vsc).

---

<div align="center"><h1><img src="./assets/mythicIcon_128x128.png" height=40> VSCode Mythic</h1></div>

<div align="center">
    <a href="https://discord.gg/SHthmb6t6n">
        <img src="https://img.shields.io/static/v1?logo=discord&label=&message=Discord&    color=36393f&style=flat-square" alt="Discord">
    </a>
    <a href="https://github.com/0tickpulse/vscode-mythic/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/License-AGPLv3-red?style=flat-square">
    </a>
</div>

<p align="center">A Visual Studio Code extension that adds language support for MythicMobs configurations.</p>

## 📖 Table of Contents

- [THIS EXTENSION IS DEPRECATED](#this-extension-is-deprecated)
  - [📖 Table of Contents](#-table-of-contents)
  - [🚀 Features](#-features)
    - [🎉 Current](#-current)
      - [Basic Syntax Highlighting](#basic-syntax-highlighting)
      - [Go to definition and references](#go-to-definition-and-references)
      - [Color decorations](#color-decorations)
    - [🚧 Planned](#-planned)
  - [🚩 Current Limitations](#-current-limitations)
  - [🛣️ Roadmap](#️-roadmap)
  - [📦 Installation](#-installation)
  - [📝 License](#-license)
  - [❤️ Credits and Acknowledgements](#️-credits-and-acknowledgements)

## 🚀 Features

### 🎉 Current

#### Basic Syntax Highlighting

![Syntax Highlighting](./assets/showcase_syntax_highlight.png)

(Using the [One Dark Pro](https://marketplace.visualstudio.com/items?itemName=zhuangtongfa.Material-theme) theme and the [CodeSnap](https://marketplace.visualstudio.com/items?itemName=adpyke.codesnap) extension)

#### Go to definition and references

(Todo: Add gif)

#### Color decorations

Below is a screenshot of item lore configuration (Credits: [@LcorpOfficial](https://github.com/LcorpOfficial)):

![Color Decorations](./assets/color_decorations.png)

### 🚧 Planned

- Complete data set
- Autocompletions

## 🚩 Current Limitations

- The extension is not built with YAML aliases in mind. This might be changed in the future, but for now, they will lead to unexpected behavior.
- The extension is meant to be used in one single workspace/server. It is not (yet?) possible to use it in multiple workspaces/servers at once.
- The extension does not recognize submappings. This means that keys like `Options.B: 1` will be recognized as `Options.B` literally instead of `Options` and `B`.

## 🛣️ Roadmap

- [ ] Complete data set
- [ ] Major code cleanup - the current code is quite messy with tons of duplicate code, global state, etc. To make the extension more stable and easier to maintain, I'll have to rewrite a major portion of the code. This will probably come with a major version bump.
- [ ] Sublime Text port - this will require a rename of the extension
- [ ] Autocompletions

## 📦 Installation

Install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=0tickpulse.vscode-mythic)

## 📝 License

This project is licensed under AGPLv3. A copy can be found [here](./LICENSE).

## ❤️ Credits and Acknowledgements

- Microsoft and the VSCode team, for providing the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), [VSCode Extension API](https://code.visualstudio.com/api), [YAML tmLanguage](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide), and more.
- [MythicMobs](https://www.mythicmobs.net/) and [its community](http://www.mythicmobs.net/discord), for creating and maintaining the plugin.
- Every contributor on my discord server, for helping me with testing and providing feedback.
