#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parse as parseYaml } from 'yaml';
import semver from 'semver';
import { renderLandingPage } from './lib/landing-page.mjs';

const require = createRequire(import.meta.url);
const REDOCLY_CLI = require.resolve('@redocly/cli/bin/cli.js');
const SPEC_PATH = path.resolve('spec/openapi.yaml');
const isLocal = process.argv.includes('--local');

function redocly(args) {
  execFileSync(process.execPath, [REDOCLY_CLI, ...args], { stdio: 'inherit' });
}

function readSpecVersion() {
  const raw = readFileSync(SPEC_PATH, 'utf8');
  const doc = parseYaml(raw);
  const version = doc?.info?.version;
  if (!version) {
    throw new Error('spec/openapi.yaml is missing info.version');
  }
  return version;
}

function lint() {
  console.log('Linting spec...');
  redocly(['lint', SPEC_PATH]);
}

function buildDocs(outputHtmlPath, version) {
  mkdirSync(path.dirname(outputHtmlPath), { recursive: true });
  redocly(['build-docs', SPEC_PATH, '-o', outputHtmlPath, '--title', `Task Manager API v${version}`]);
}

function runLocal() {
  lint();
  const version = readSpecVersion();
  buildDocs(path.resolve('dist/index.html'), version);
  console.log(`Built local preview for v${version} at dist/index.html`);
}

function runCi() {
  const publishDir = process.env.PUBLISH_DIR;
  const refName = process.env.GITHUB_REF_NAME;
  if (!publishDir) throw new Error('PUBLISH_DIR env var is required in CI mode');
  if (!refName) throw new Error('GITHUB_REF_NAME env var is required in CI mode');

  if (!refName.startsWith('v')) {
    throw new Error(`Tag "${refName}" must start with "v" (e.g. v1.0.0)`);
  }
  const tagVersion = refName.slice(1);
  if (!semver.valid(tagVersion)) {
    throw new Error(`Tag "${refName}" is not a valid semver version`);
  }

  const specVersion = readSpecVersion();
  if (specVersion !== tagVersion) {
    throw new Error(
      `Tag ${refName} does not match spec/openapi.yaml info.version=${specVersion} - did you forget to bump the version?`
    );
  }

  lint();

  mkdirSync(publishDir, { recursive: true });
  const versionDir = path.join(publishDir, tagVersion);
  if (existsSync(versionDir)) {
    throw new Error(
      `Version ${tagVersion} is already published at ${versionDir} - bump the version to publish new changes`
    );
  }

  buildDocs(path.join(versionDir, 'index.html'), tagVersion);

  const manifestPath = path.join(publishDir, 'versions.json');
  let manifest = { latest: null, versions: [] };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  }
  manifest.versions = Array.from(new Set([...manifest.versions, tagVersion])).sort(semver.compare);

  const stableVersions = manifest.versions.filter((v) => !semver.prerelease(v));
  const latest =
    stableVersions.length > 0 ? stableVersions[stableVersions.length - 1] : manifest.versions[manifest.versions.length - 1];
  manifest.latest = latest;

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const latestDir = path.join(publishDir, 'latest');
  mkdirSync(latestDir, { recursive: true });
  cpSync(path.join(publishDir, latest, 'index.html'), path.join(latestDir, 'index.html'));

  const landingHtml = renderLandingPage({ versions: manifest.versions, latest: manifest.latest });
  writeFileSync(path.join(publishDir, 'index.html'), landingHtml);

  console.log(`Published version ${tagVersion}. Latest is now ${latest}.`);
  console.log(`Versions on site: ${manifest.versions.join(', ')}`);
}

try {
  if (isLocal) {
    runLocal();
  } else {
    runCi();
  }
} catch (err) {
  console.error(`\nrelease.mjs failed: ${err.message}\n`);
  process.exit(1);
}
