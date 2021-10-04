#!/bin/sh

rm -rf public/*.html
rm -rf public/*.js
rm -rf public/*.LICENSE.txt

cp dist/index.bundle.js dist/privacypolicy.bundle.js dist/acceptableuse.bundle.js dist/index.html dist/privacypolicy.html dist/acceptableuse.html public
