# Foreword

I am not an expert at writing code. At least that is how I see myself. But I am also not someone who discovered that ChatGPT can make apps and immediately decided to build the must-have application everyone has always wanted.

The Novelist comes from several needs:

- As a writer
  I have written short stories and novels since I was a kid. There was also a period of my life when I published some of my work with small publishers, won a few contests, and made this vocation public.
  To write, I used a bit of everything. I started with Microsoft Word, then used Google Write for a short time, then moved through other specialized writing apps such as Scrivener, and eventually returned to Pages.
  I always needed an application that would let me write my stories while also helping me keep track of locations, characters, and the content of the various chapters. I wanted a program that would let me write individual chapters and then organize them later, changing the structure of the novel to get the best effect.
  But I never found the right app. So I decided to make it myself.

- As an AI enthusiast
  Artificial intelligence is an incredible tool, and as you have already seen with Coworker, I do not limit myself to simply using a chatbot. I therefore wanted to integrate AI into this writing app. I wanted a tool that, starting from the description of a character or a place, would create a portrait or an image of that place. I wanted the editor to help me with difficult passages simply by selecting them. And I wanted each chapter, as it was written, to have a small summary attached to it, useful for later building the final structure of the novel.

- As a natural consequence of other projects I am working on
  Thanks to the experience I am gaining with other applications I am developing for various purposes, I thought the time had really come to lay the first stone with The Novelist.

1. I wanted a modular structure: why not use an interface made of blocks and connections? Each block represents a chapter. Connections let me choose how to link one chapter to another.
2. I wanted to manage parallel plots better: the block interface is perfect. Blocks belonging to the same plot all have the same color. If I generate another narrative path, it has a different color.
3. I wanted character cards: again, a block interface. Each block is an identikit-style character card. In the card it is even possible to indicate in which chapters the character appears. And with AI I can even generate an image of the character.
4. I wanted landscape/location cards: again, a block interface. They are identical in every way to character cards, but dedicated to locations.
5. AI intervention: for text assistance the app uses OpenAI API or Ollama. For full cloud features, including in-app image generation, an OpenAI API key is required. Ollama remains available as a local provider for those who want to keep text on their own computer.

All of this led to The Novelist.

The application was built entirely with AI assistance. The interface is a bit techie, but I do not mind it, even if I could have insisted a bit more on making it more user-friendly.

Is it perfect?
Let's say it works, and I do not think it has obvious bugs. At the moment the project is maintained with locally verified builds on macOS and Windows, so that declared support and actually verified support remain aligned.
A professional developer might find many flaws in it, and perhaps some vulnerabilities that escaped me. I leave to them the burden and honor of fixing what my inexperienced eyes did not find.
In any case, it remains, always, an app made through vibe-coding.

# The Novelist - User Manual (EN)

> This app was created through vibecoding with Codex CLI. It should currently be considered a working alpha. It may need optimization, cleanup of orphaned code, security work, and much more...

## Table of Contents

- Introduction
- Getting started
- The interface
- Chapters/Scenes canvas: how the text editor works
- Plots/Characters/Locations canvases
- Memory
- Settings

## Introduction

The Novelist is an experimental project designed for writers. The application provides a set of useful tools for structuring complex narrative work and managing its individual parts.
The project is currently maintained and distributed with packages locally verified on macOS and Windows.

### Interface language

The Novelist has a bilingual Italian/English interface. The language is selected automatically based on the system settings. If the computer is set to a language other than Italian, English is selected automatically. The setting can also be changed manually from the Settings window.

_Note:_ Project content is not translated automatically: chapters, scenes, plots, cards, Wiki memory, and selected text remain in the language used by the author.

Main features:

- Dashboard with all information about the novel/short story.
- Graphic story timeline.
- Node structure to define the outline of the novel/short story.
- Plot cards.
- Character cards.
- Location cards.
- Every narrative block (scene/chapter) has an AI-assisted editor.
- Every Character Card and Location Card has an AI assistant.
- Revision management tool for every scene/chapter/character/location.
- Novel/short story analysis tool with AI assistance.
- Consultation tool for the novel/short story "memory".
- Ability to print an individual narrative block (chapter).
- Ability to print the entire novel.
- Export to ePUB and DOCX.

Secondary features:

- Connection to cloud models through API keys.
- Connection to local models through Ollama.

## Getting started

### Download, signing, and checksums

The Novelist was born as a personal program and was later published as an open source project under the Apache 2.0 license. Published builds are not signed with Apple or Windows certificates.

This means that:

- on macOS, a Gatekeeper warning may appear on first launch;
- on Windows, a SmartScreen or "unknown publisher" warning may appear;
- the source code remains inspectable in the repository, but downloaded packages do not have a commercial operating-system signature.

It is therefore possible that, on launch, the operating system will ask for permission before opening the app.

Note: If you have doubts, the repository includes checksums for the programs. The Tech area of this document contains instructions for verifying that the files have not been compromised.

### Launching The Novelist

On both macOS and Windows, simply double-click the program icon.

### Creating a novel/short story

Click Create.
Enter the directory where the project should be placed.
Enter the project title.
Enter a target word count for the whole novel/short story and for individual chapters (optional, but useful).
Enter an expected completion date for the project (optional, but useful).

### Setting up AI activities

When a new writing project is created, AI services are disabled by default. To make them work, go to the Settings menu, choose the type of AI to use, and enable access to the data you want to share with artificial intelligence.

### Defining one or more plots

Click Plots.
Click New Plot.
Define the plot number. The program can manage multiple parallel plots. For example, you can create a main plot plus other secondary plots linked to individual characters. Choose the number immediately after the last one used. For the main plot, use 1.
Define a plot name (Main Plot, Character Story, etc.).
Write a draft, an idea, a structure, or a short summary of the plot you want to define.
Click Create Plot.
A box related to the plot will be created. The plot will be defined by title, number, and color. By double-clicking the box, you can review what was written and modify it if needed.
Alternatively, you can click Create Chapters. In this case, in addition to generating the plot box, the AI produces a number of chapters with an indication of the topic each should cover to complete the work. This generation is only a proposal, and the author can modify it at any time or delete it.

### Starting to write

Depending on how the author wants to work, it is possible to start directly by writing a chapter of the book, or simply by writing one of the scenes that will be included in the chapters.
The choice is entirely personal. From chapter drafting, it is possible to define the various scenes later. Or, after writing individual scenes, it is possible to open an empty chapter and recall the scenes in the preferred order.
The editor is simple but has everything needed, namely:

- Text justification.
- Text and font formatting.
- Search system.
- Search and replace system.
- Correction systems for selected text (through AI).
- AI chatbot for consultation/research.
  The editor recognizes `<<` and `>>` as dialogue "angle quotes" and converts them into the correct typographic symbols.
  Whether writing a scene or a chapter, it is possible to select text and define it as the description of a character or a location. With that definition, the app will automatically generate a character card (optionally including an image) or a location card (optionally including an image).
  To correlate characters/landscapes with chapters/scenes, simply recall them with `@`. This lets the author always know where a character appears or which chapters take place in a given location.
  All information will be used to create a project "memory" and to populate both the dashboard and the timeline. The information will also be essential for the AI to know what is being worked on.

### Timeline

The timeline is useful for placing narrated events in chronological order. It is built manually, but each time you enter the timeline view it will show elements already positioned and new elements still to be positioned. From the sidebar, the author can choose between Chapter Timeline and Scene Timeline, so the two chronological views can be managed separately.
The author can also specify precise start and end dates for the timeline, and define specific dates for each individual element connected to it.

### Outline

The outline is a vertical drag-and-drop tool where the author can arrange chapters as preferred. Printing or exporting the novel/short story will follow the order chosen in this view. The Open button lets you read a chapter, or the entire document, in a distraction-free window designed not to strain the eyes.

### Revisions

The program keeps a record of every change made to chapters and scenes, as well as to character and location cards. If you want to go back, you can open the Revisions view, find the desired version, and restore it.
Be careful, however: once an old draft is restored, it will no longer be possible to return to the latest generated version.

### Analysis

The program offers a series of tools that, thanks to AI, can evaluate the written text and identify potential flaws or possible missing elements.

### Memory

The program stores every change, every AI request, and every save made by the user. This program "memory" can be queried at any time through a search bar that works in a Google-like style.

## The interface

The main interface is divided into three distinct areas.

### Control center

Below the logo, there are several buttons that let you move between the various views.

### Dashboard

The Dashboard collects metrics, goals, delivery projections, and operational project status. Below the main commands there is a dedicated box with the estimated delay, the buttons to refresh the dashboard and memory, and three traffic lights showing whether memory is up to date, whether AI is active, and whether the AI fallback is available or set to No AI.

### Command area (left)

The left side of the application usually contains a series of options useful for the selected view. These are usually buttons for creating new elements, getting information about selected elements, and possibly deleting them.

### Canvas (right)

The right side is the workspace. It is a board on which to place blocks, where each block represents an element related to the selected view, and decide how to connect them to each other. In analysis pages, as well as in the dashboard and memory, the information specific to the selected view will be shown.
Individual elements can be selected, moved using click-and-drag, or deleted. It is also possible to select multiple elements either by holding down the CTRL key and clicking on individual objects, or by holding down the left mouse button and creating a selection area containing the desired objects. Once a group of elements has been selected, they can be moved or deleted just like a single object.

## Chapters/Scenes Canvas: How the text editor works

The text editor is very simple. Here too it is divided into two distinct areas:

- On the left side there is the writing editor. You can edit the chapter or scene title, choose style, font type, justification, and font size. Writing is lightweight. It recognizes `-` and the dialogue markers `<<` and `>>`. If you need a bulleted list (really?), just use an asterisk. The editor will also show the associated location and characters. If you select text, you can edit it directly through AI.
- On the right side there is a chatbot-style interface for consulting AI when needed.
  The editor also lets you export the chapter to DOCX or print it.
  When leaving the editor, the AI will summarize what was written and place it in the block description.

To recall a character or a location, type `@` and choose from the list. The reference will not be visible during export, but it will create a correlation between elements, visible both in the editor and in character and landscape/location cards.
If you want to create a new character or a new location without going through the Characters/Locations canvases (see later chapters), write the description in the editor, select the text, and right-click it. A dedicated menu will open to generate what you want directly. Once confirmed, the program will create the card directly for the user, filling in the attributes through AI, which searches the highlighted text for data and places it in the correct fields. If APIs are enabled, an image will also be generated automatically, again based on the description.
In the text editor, of course, the selected text will remain present, and the badge for the newly created character or location will appear.
It is also possible to create a scene in the same way. In this case, the scene will be marked with `#`.

Editor keyboard shortcuts:

| Action                     | Windows/Linux                     | macOS                            |
| -------------------------- | --------------------------------- | -------------------------------- |
| Save chapter               | `Ctrl+S`                          | `Cmd+S`                          |
| Print chapter              | `Ctrl+P`                          | `Cmd+P`                          |
| Line spacing 1             | `Ctrl+Enter`                      | `Cmd+Enter`                      |
| Find                       | `Ctrl+F`                          | `Cmd+F`                          |
| Replace                    | `Ctrl+H`                          | `Cmd+H`                          |
| Next result                | `Enter` in the Find bar           | `Enter` in the Find bar          |
| Previous result            | `Shift+Enter` in the Find bar     | `Shift+Enter` in the Find bar    |
| Replace current occurrence | `Ctrl+Enter` in the Replace field | `Cmd+Enter` in the Replace field |
| Close Find/Replace         | `Esc`                             | `Esc`                            |
| Send AI message            | `Ctrl+Enter` in chat              | `Cmd+Enter` in chat              |
| Bold                       | `Ctrl+B`                          | `Cmd+B`                          |
| Italic                     | `Ctrl+I`                          | `Cmd+I`                          |
| Undo                       | `Ctrl+Z`                          | `Cmd+Z`                          |
| Redo                       | `Ctrl+Shift+Z`                    | `Cmd+Shift+Z`                    |

## Plots/Characters/Locations Canvases

The two areas are not very different from those already described. Both the character block and the landscape/location block let you enter specific characteristics and optionally generate an image of the character/landscape.
Both character blocks and location blocks have handles, exactly as in the Project Structure canvas. This makes it possible to connect characters who have a relationship, or locations linked to each other.
The Plots canvas is not different from the other two, but it offers the features already described in the main interface, through the `Plots` tab and the `New Plot` button.

Note: If you use API keys, it will be possible to generate and attach the image directly with the Generate In-App button. Otherwise, you will need to create the prompt, copy it to a cloud chatbot, generate the image, download it, and attach it with the Attach button.

## Revisions
The program allows users to compare the current version of a text (Chapter, Scene, Character, Location) with its previous versions. The program highlights differences, additions, and deletions, so that the author has a clear understanding of what has changed between the various versions and the most recent one.

If desired, the author can restore a previous draft by clicking the Restore button.

## Analysis

The program includes a series of AI-powered services capable of identifying potential issues in these areas:

- Narrative Coherence: timing, characters, and locations described in contradictory ways, etc.
- Unresolved events: events, narrative promises, and plots left open.
- Style: tone, punctuation, recurring language, repetitions, and readability of the text.
- Narrative rhythm: weak chapters, redundant scenes, superficial characters, or characters absent from the narrative.
- Names and conventions: proper names, terminology, conventions, and internal consistency.

The report provided is only indicative, but useful to the author during the revision phase. If desired, the report can be printed to preserve the information and make corrections later.

## Memory

Each writing project has been given a sort of Wiki page that is updated at every save and that the AI can access to have greater awareness of the novel and provide more coherent answers. The Wiki memory contains information from the Text Editor, Plots, Characters, and Locations. Data is updated automatically, but manual updates can also be performed. The memory also tracks conversations with the AI in the text editor, so that they enrich the AI's knowledge as well. The AI should be seen as a 360-degree assistant.

The memory can be queried at any time, both from the chatbot in the text editor and directly from the view called Memory. There is a Google-style search bar. In addition to answers related to the question asked or the keyword searched, the sources from which the answer was extracted will be available.

## Settings

The settings menu is mainly used to:

- Set autosave.
- Set the program language.
- Set the interface theme.
- Set the AI service to use.
- Set consent for AI to use data stored in the Wiki.
- Enter the API key, if needed.

### Autosave

The program lets you choose between:

1. Manual save.
2. Save every N minutes.
3. Automatic save on every user change.

### Interface Language

The program lets you choose between:

1. Automatic.
2. Italian.
3. English.

### Interface Theme

The program lets you choose between:

1. System Theme.
2. White.
3. Black.

### AI Settings

Here you can choose the AI model to use (OpenAI API key or Ollama), the fallback in case the chosen AI has problems (including No AI), and set the models to which requests will be made. Before changing the defaults, check token costs.

### Consents

This area contains the checkboxes used to enable the various AI features provided by the application.

### Secrets

This is where the API key for cloud services is entered.

#### API KEY

This is the only system that makes it possible to generate images In-App, provided the service associated with your API key supports it. Compatibility with OpenAI API keys is provided, as they are something of a de facto standard.

#### Ollama

Ollama is a tool that, once installed on your computer, lets you download local AI models measured against your PC's performance, or use open source models in the cloud. This solution is useful for those who want maximum privacy protection, at the cost of model performance.

Warning: Ollama must be installed and running on the computer. Otherwise, the local provider will not be active.

The settings menu also includes four important checkboxes:

1. Consent to send text to AI tools: without this consent, AI services cannot be used.
2. Enable external API calls: without this consent, the API key service cannot work.
3. Auto-summary of block description on save: without this consent, automatic chapter summaries will not be added to the block description.
4. Consent to send project memory to external providers: if disabled, AI will not receive the Wiki memory when the provider or fallback can send the prompt outside the computer.

There is also a Fallback in case the chosen AI service is not operational for some reason. This fallback can redirect requests to the other available provider, or be completely "Non-AI".

_Note:_ AI settings are saved inside individual projects. Autosave preferences, instead, are global user preferences, so they remain valid even when another project is opened or created.

## License

This project is distributed under the Apache 2.0 license. See [LICENSE](./LICENSE).
