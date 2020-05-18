## Translations

The translation files are a simple JSON data structure. Every entry has a Key, and then the text that goes with it. 

Example: `"title-commnity-atlas": "Community Atlas" `

The first item, in this case "title-commnity-atlas" is the key. This must not be modified as it is used to find the text. The second element "Community Atlas" is the translateable text, modify this as needed, but make sure that the quotes stay intact. 

To add a translation, edit the file for the language, and modify the second part of the data, replacing english text with the translated version. The simplest way to edit the file is directly on GitHub.  

```
        "title-commnity-atlas": "Community Atlas",
        "menu_display": "Display",
        "menu_map": "Map",
        "menu_timeline": "Timeline",
        "menu_cards": "Cards", 
        "filter_categories": "Categories",
        "filter_types": "Types",
        "filter_tags": "Tags",
        "filter_reset": "Reset filters",
        "tools_source_editor": "Source editor",
        "tools_raw": "Raw GeoJSON source",
        "tools_reload": "Reload JSON data",
        "toast_available": "$1 {{PLURAL:$1|feature|features}} available to explore",
        "toast_reset": "There are no features that match your filter. Update or reset your filters.",
        "sort_alpha": "Sort alphabetically",
        "sort_creation": "Sort by creation time",
        "sort_update": "Sort by update time"
```

In most cases, the translation is very simple and direct, but sometimes there is a little bit of logic to manage plurals. 

`toast_available": "$1 {{PLURAL:$1|feature|features}} available to explore"`

In this example, the structure within the curly braces needs to have two components, the singular and the plural version of the phrase.  Here, you need to replace the word "feature" with the singular translation, and "features" with the plural - making sure that the rest of the structure is not changed. 


## Save and it goes live
The moment you "commit changes" to a translation file, it will be added to the code and published within a few minutes. 


