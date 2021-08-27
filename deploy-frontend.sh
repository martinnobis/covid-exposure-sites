#!/bin/sh

uglifyjs script.js -o public/script.min.js -c drop_console

html-minifier \
    --collapse-whitespace \
    --remove-comments \
    --remove-optional-tags \
    --remove-redundant-attributes \
    --remove-script-type-attributes \
    --remove-tag-whitespace \
    --use-short-doctype \
    --minify-css true \
    --minify-js true \
    index.html -o public/index.html

cssnano < style.css > public/style.min.css