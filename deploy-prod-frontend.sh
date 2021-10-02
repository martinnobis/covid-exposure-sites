#!/bin/sh

rm -rf public/*.html
rm -rf public/*.js
rm -rf public/*.LICENSE

# JS
cp dist/index.*.bundle.js public/
cp dist/index.*.bundle.js.LICENSE.txt public/
cp dist/privacypolicy.*.bundle.js public/
cp dist/acceptableuse.*.bundle.js public/

# HTML
cp dist/index.html public/
cp dist/privacypolicy.html public/
cp dist/acceptableuse.html public/
