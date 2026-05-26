#!/bin/bash

cd /storage/emulated/0/Download/kernel-wallet-extension

git config --global --add safe.directory /storage/emulated/0/Download/kernel-wallet-extension

git add .

git remote remove origin 2>/dev/null

git remote add origin https://github.com/Amir3558hassan/kernel-wallet-extension.git

git config user.email "amir3558hassan@gmail.com"

git config user.name "Amir3558hassan"

git commit -m "Initial upload" || echo "Nothing to commit"

git branch -M main

git push -u origin main

echo "Upload completed successfully!"
