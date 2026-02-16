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

### 2. Build and package

```bash
npm install
npm run package
```

This produces a file named `bamoe-<version>.vsix`.

### 3. Create the GitHub Release

```bash
gh release create v<version> bamoe-<version>.vsix \
  --title "BAMOE v<version>" \
  --notes "Release notes here..."
```

For example:

```bash
gh release create v0.2.0 bamoe-0.2.0.vsix \
  --title "BAMOE v0.2.0" \
  --notes "## What's Changed
- Added feature X
- Fixed bug Y"
```

### 4. Push

```bash
git push origin main --tags
```

## Verifying a Release

```bash
# Check the release exists and has the .vsix attached
gh release view v<version>

# Download and test locally
gh release download v<version>
code --install-extension bamoe-<version>.vsix
```

## Notes

- The `.vsix` file is excluded from git via `.gitignore`
- Always test the packaged `.vsix` in a clean VS Code window before publishing
- Use `--draft` with `gh release create` if you want to review before making it public
