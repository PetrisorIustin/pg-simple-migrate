const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

// Read the current version from package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

// Determine the next version (you can customize this logic)
const nextVersion = semver.inc(currentVersion, 'patch');

// Update the version in package.json
packageJson.version = nextVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Publish the package
try {
  execSync('npm publish', { stdio: 'inherit' });
} catch (error) {
  console.error('Error publishing the package:', error.message);
  process.exit(1);
}

console.log(`Package version ${nextVersion} published successfully.`);
