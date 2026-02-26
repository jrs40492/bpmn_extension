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

### 2. Write release notes

Create a release notes file and add your changes:

```bash
VERSION=$(node -p "require('./package.json').version")
touch release_notes/$VERSION.md
```

Then open `release_notes/$VERSION.md` and write the release notes for this version.

### 3. Get review and merge

Push your branch, open a PR, and get it reviewed. Once approved, merge the PR into `main`.

### 4. Pull main and build the package

```bash
git checkout main
git pull origin main
VERSION=$(node -p "require('./package.json').version")
git push origin v$VERSION
npm install
npm run package
```

This produces a file named `bamoe-$VERSION.vsix`.

### 5. Create the GitHub Release

```bash
gh release create v$VERSION bamoe-$VERSION.vsix \
  --title "BAMOE v$VERSION" \
  --notes-file release_notes/$VERSION.md
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
