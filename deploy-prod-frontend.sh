#!/bin/sh

# uglifyjs script.js -m toplevel -c -o public/script.min.js -c drop_console
cp dist/index.bundle.js dist/main.css public/

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
    src/index.html -o public/index.html

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
    src/privacypolicy.html -o public/privacypolicy.html

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
    src/acceptableuse.html -o public/acceptableuse.html

# cssnano < style.css > public/style.min.css

# rm -f public/style.css public/script.js
