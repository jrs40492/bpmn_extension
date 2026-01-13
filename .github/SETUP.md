# BAMOE CI/CD Pipeline Setup

## Quick Start

1. Copy the `.github` folder to your BAMOE repository root
2. Configure repository secrets (see below)
3. Add Maven plugins to your `pom.xml` (see below)
4. Push to any branch to trigger the pipeline

---

## Repository Secrets

Configure in GitHub → Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `MAVEN_USERNAME` | Username for external Maven repository |
| `MAVEN_PASSWORD` | Password/token for external Maven repository |

---

## Required Maven Plugins

Add these to your `pom.xml` `<build><plugins>` section:

```xml
<!-- Checkstyle -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-checkstyle-plugin</artifactId>
  <version>3.3.1</version>
</plugin>

<!-- SpotBugs -->
<plugin>
  <groupId>com.github.spotbugs</groupId>
  <artifactId>spotbugs-maven-plugin</artifactId>
  <version>4.8.3.1</version>
</plugin>

<!-- JaCoCo Coverage -->
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.11</version>
</plugin>

<!-- OWASP Dependency Check -->
<plugin>
  <groupId>org.owasp</groupId>
  <artifactId>dependency-check-maven</artifactId>
  <version>9.0.9</version>
</plugin>
```

---

## Distribution Management

Add this to your `pom.xml` for artifact deployment:

```xml
<distributionManagement>
  <repository>
    <id>maven-releases</id>
    <url>https://your-nexus-server/repository/maven-releases/</url>
  </repository>
  <snapshotRepository>
    <id>maven-snapshots</id>
    <url>https://your-nexus-server/repository/maven-snapshots/</url>
  </snapshotRepository>
</distributionManagement>
```

**Important:** The `<id>` must match `server-id` in the workflow (defaults to `maven-releases`).

---

## Pipeline Features

| Job | Description | Runs On |
|-----|-------------|---------|
| **Build & Test** | Compiles, runs tests, uploads artifacts | All branches |
| **Code Quality** | Checkstyle, SpotBugs, JaCoCo coverage | After build |
| **Security Scan** | OWASP dependency vulnerability check | After build |
| **Validate BPMN/DMN** | XML well-formedness validation | All branches |
| **Deploy** | Publishes to Maven repository | main/master/release branches |
| **PR Check** | Aggregates all checks for PRs | Pull requests |

---

## Customization

### Change Java Version
Edit `env.JAVA_VERSION` in `ci.yml`:
```yaml
env:
  JAVA_VERSION: '21'  # Change to '17' or '11' if needed
```

### Adjust Coverage Thresholds
Edit the JaCoCo report step in the `code-quality` job:
```yaml
min-coverage-overall: 60      # Minimum overall coverage %
min-coverage-changed-files: 80 # Minimum coverage for changed files %
```

### Add Deploy Branches
Edit the `deploy` job `if` condition:
```yaml
if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master' || startsWith(github.ref, 'refs/heads/release/') || github.ref == 'refs/heads/develop'
```

### Make Quality Checks Blocking
Remove `continue-on-error: true` from Checkstyle/SpotBugs steps to fail the build on violations.
