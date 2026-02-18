# Release Process

How to create a new release of the BAMOE extension.

## Steps

### 1. Update the version

Bump the version in `package.json`:

```bash
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0
```

This updates `package.json` and creates a git commit + tag automatically.

### 2. Set the VERSION variable

```bash
VERSION=$(node -p "require('./package.json').version")
```

This reads the version from `package.json` so it can be used in subsequent steps.

### 3. Build and package

```bash
npm install
npm run package
```

This produces a file named `bamoe-$VERSION.vsix`.

### 4. Write release notes

Create a file at `release_notes/$VERSION.md` with the changes for this release:

```bash
cat > release_notes/$VERSION.md << 'EOF'
## What's Changed

- Added feature X
- Fixed bug Y
EOF
```

### 5. Create the GitHub Release

```bash
gh release create v$VERSION bamoe-$VERSION.vsix \
  --title "BAMOE v$VERSION" \
  --notes-file release_notes/$VERSION.md
```

### 6. Push

```bash
git push origin main --tags
```

## Verifying a Release

```bash
# Check the release exists and has the .vsix attached
gh release view v$VERSION

# Download and test locally
gh release download v$VERSION
code --install-extension bamoe-$VERSION.vsix
```

## Notes

- The `.vsix` file is excluded from git via `.gitignore`
- Release notes are stored in `release_notes/` and committed to the repo
- Always test the packaged `.vsix` in a clean VS Code window before publishing
- Use `--draft` with `gh release create` if you want to review before making it public
